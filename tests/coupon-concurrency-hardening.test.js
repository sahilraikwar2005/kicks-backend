import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Coupon from '../src/modules/coupons/model.js';
import CouponRedemption from '../src/modules/coupons/redemption.model.js';
import CouponUserUsage from '../src/modules/coupons/userUsage.model.js';
import Order from '../src/modules/orders/model.js';
import Payment from '../src/modules/payments/model.js';
import Product from '../src/modules/products/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { couponService } from '../src/modules/coupons/service.js';
import { paymentService } from '../src/modules/payments/service.js';

const makeCoupon = (overrides = {}) => Coupon.create({
  code: `CC${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
  type: 'FIXED',
  value: 10,
  minCartValue: 0,
  expiryDate: new Date(Date.now() + 86400000),
  usageLimit: 0,
  perUserLimit: 1,
  active: true,
  ...overrides,
});

const makeOrder = (coupon, userId = new mongoose.Types.ObjectId(), index = '') => Order.create({
  user: userId,
  orderNumber: `CP-${Date.now()}-${Math.random().toString(36).slice(2)}-${index}`,
  items: [{
    productId: new mongoose.Types.ObjectId(),
    variantId: new mongoose.Types.ObjectId(),
    productName: 'Coupon Shoe',
    sku: `CP-${Date.now()}-${index}`,
    size: 'US 9',
    color: 'Black',
    quantity: 1,
    unitPrice: 100,
    finalPrice: 100,
  }],
  shippingAddress: { addressLine1: '123 Main', city: 'Mumbai', country: 'India' },
  customerSnapshot: { firstName: 'Coupon', lastName: 'User', email: `coupon-${index}@example.com` },
  subtotal: 100,
  discountAmount: 10,
  grandTotal: 90,
  couponCode: coupon.code,
  status: 'PENDING',
  paymentStatus: 'PENDING',
});

const cleanupCoupon = async (coupon) => {
  await CouponRedemption.deleteMany({ coupon: coupon?._id }).catch(() => {});
  await CouponUserUsage.deleteMany({ coupon: coupon?._id }).catch(() => {});
  await Order.deleteMany({ couponCode: coupon?.code }).catch(() => {});
  if (coupon) await Coupon.deleteOne({ _id: coupon._id }).catch(() => {});
};

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

test('coupon concurrency: global usage limit is never oversubscribed', async () => {
  const coupon = await makeCoupon({ usageLimit: 5, perUserLimit: 0 });
  const orders = await Promise.all(Array.from({ length: 50 }, (_, index) => makeOrder(coupon, new mongoose.Types.ObjectId(), index)));

  const results = await Promise.allSettled(orders.map((order) => couponService.consumeForPaidOrder(order)));
  const successes = results.filter((result) => result.status === 'fulfilled' && result.value.consumed);

  assert.equal(successes.length, 5);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 5);
  assert.equal(await CouponRedemption.countDocuments({ coupon: coupon._id, status: 'REDEEMED' }), 5);
  await cleanupCoupon(coupon);
});

test('coupon concurrency: per-user limit allows one same-user redemption under concurrent requests', async () => {
  const coupon = await makeCoupon({ usageLimit: 100, perUserLimit: 1 });
  const userId = new mongoose.Types.ObjectId();
  const orders = await Promise.all(Array.from({ length: 25 }, (_, index) => makeOrder(coupon, userId, index)));

  const results = await Promise.allSettled(orders.map((order) => couponService.consumeForPaidOrder(order)));
  const successes = results.filter((result) => result.status === 'fulfilled' && result.value.consumed);

  assert.equal(successes.length, 1);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
  assert.equal((await CouponUserUsage.findOne({ coupon: coupon._id, user: userId })).count, 1);
  await cleanupCoupon(coupon);
});

test('coupon concurrency: same order retry is idempotent and increments once', async () => {
  const coupon = await makeCoupon({ usageLimit: 10, perUserLimit: 3 });
  const order = await makeOrder(coupon, new mongoose.Types.ObjectId(), 'same-order');

  const results = await Promise.allSettled(Array.from({ length: 10 }, () => couponService.consumeForPaidOrder(order)));
  const successes = results.filter((result) => result.status === 'fulfilled' && result.value.consumed);
  const duplicates = results.filter((result) => result.status === 'fulfilled' && result.value.duplicate);

  assert.equal(successes.length, 1);
  assert.equal(duplicates.length, 9);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
  assert.equal(await CouponRedemption.countDocuments({ coupon: coupon._id, order: order._id }), 1);
  await cleanupCoupon(coupon);
});

test('coupon concurrency: failed payment does not consume coupon; successful payment consumes once', async () => {
  const coupon = await makeCoupon({ usageLimit: 3, perUserLimit: 1 });
  const product = await Product.create({
    name: 'Coupon Payment Shoe',
    slug: `coupon-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    price: 100,
    status: 'PUBLISHED',
    variants: [{ sku: `COUPON-PAY-${Date.now()}`, size: 'US 9', color: 'Black', price: 100, stock: 5 }],
  });
  const userId = new mongoose.Types.ObjectId();
  const variantId = product.variants[0]._id;
  const order = await Order.create({
    user: userId,
    orderNumber: `CP-PAY-${Date.now()}`,
    items: [{
      productId: product._id,
      variantId,
      productName: product.name,
      sku: product.variants[0].sku,
      size: 'US 9',
      color: 'Black',
      quantity: 1,
      unitPrice: 100,
      finalPrice: 100,
    }],
    shippingAddress: { addressLine1: '123 Main', city: 'Mumbai', country: 'India' },
    customerSnapshot: { firstName: 'Coupon', lastName: 'Payment', email: 'coupon-payment@example.com' },
    subtotal: 100,
    discountAmount: 10,
    grandTotal: 90,
    couponCode: coupon.code,
  });
  const payment = await Payment.create({
    order: order._id,
    user: userId,
    gateway: 'RAZORPAY',
    gatewayOrderId: `order_coupon_${Date.now()}`,
    amount: 90,
    currency: 'INR',
    status: 'PENDING',
  });

  await Payment.updateOne({ _id: payment._id }, { $set: { status: 'FAILED' } });
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 0);

  await Payment.updateOne({ _id: payment._id }, { $set: { status: 'PENDING' } });
  const paid = await paymentService.markPaid(payment, `pay_coupon_${Date.now()}`);
  const duplicate = await paymentService.markPaid(paid, paid.paymentId);

  assert.equal(duplicate.status, 'PAID');
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
  assert.equal(await CouponRedemption.countDocuments({ coupon: coupon._id, status: 'REDEEMED' }), 1);

  await CouponRedemption.deleteMany({ coupon: coupon._id });
  await CouponUserUsage.deleteMany({ coupon: coupon._id });
  await Coupon.deleteOne({ _id: coupon._id });
  await Payment.deleteOne({ _id: payment._id });
  await Order.deleteOne({ _id: order._id });
  await Product.deleteOne({ _id: product._id });
  await Inventory.deleteOne({ product: product._id, variant: variantId });
  await InventoryMovement.deleteMany({ product: product._id, variant: variantId });
});
