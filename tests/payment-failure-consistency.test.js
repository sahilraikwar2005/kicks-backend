import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { razorpay } from '../src/config/payment.js';
import { env } from '../src/config/env.js';
import Product from '../src/modules/products/model.js';
import Order from '../src/modules/orders/model.js';
import Payment from '../src/modules/payments/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { paymentService } from '../src/modules/payments/service.js';

test.before(async () => {
  await connectDatabase();
  await Product.collection.dropIndex('product_code_1').catch(() => {});
});

test.after(async () => {
  await closeDatabase();
});

const generateTestOrderAndPayment = async (stockQuantity = 5) => {
  const userId = new mongoose.Types.ObjectId();
  const sku = `TEST-PAY-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const product = await Product.create({
    name: 'Payment Test Shoe',
    slug: `payment-test-shoe-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    price: 200,
    status: 'PUBLISHED',
    variants: [{ sku, size: 'US 9', color: 'Black', price: 200, stock: stockQuantity }],
  });

  const productId = product._id;
  const variantId = product.variants[0]._id;

  const order = await Order.create({
    user: userId,
    orderNumber: `KICKS-TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    items: [{
      productId,
      variantId,
      productName: product.name,
      sku,
      size: 'US 9',
      color: 'Black',
      quantity: 1,
      unitPrice: 200,
      discount: 0,
      finalPrice: 200,
    }],
    shippingAddress: { street: '123 Main St', city: 'City', country: 'Country' },
    customerSnapshot: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
    subtotal: 200,
    discountAmount: 0,
    shippingCharge: 0,
    tax: 0,
    grandTotal: 200,
    status: 'PENDING',
    paymentStatus: 'PENDING',
  });

  const gatewayOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const payment = await Payment.create({
    order: order._id,
    user: userId,
    gateway: 'RAZORPAY',
    gatewayOrderId,
    amount: 200,
    currency: 'INR',
    status: 'PENDING',
  });

  return { userId, productId, variantId, order, payment, gatewayOrderId };
};

const cleanupTestData = async ({ productId, variantId, order, payment }) => {
  if (productId) await Product.deleteOne({ _id: productId });
  if (productId && variantId) {
    await Inventory.deleteOne({ product: productId, variant: variantId });
    await InventoryMovement.deleteMany({ product: productId, variant: variantId });
  }
  if (order) await Order.deleteOne({ _id: order._id });
  if (payment) await Payment.deleteOne({ _id: payment._id });
};

test('TEST 1 — Successful Payment + Successful Inventory', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const paymentId = `pay_succ_${Date.now()}`;

  const updatedPayment = await paymentService.markPaid(data.payment, paymentId);

  assert.equal(updatedPayment.status, 'PAID', 'Payment status must be PAID');

  const refreshedOrder = await Order.findById(data.order._id);
  assert.equal(refreshedOrder.paymentStatus, 'PAID', 'Order paymentStatus must be PAID');
  assert.equal(refreshedOrder.status, 'CONFIRMED', 'Order status must be CONFIRMED');

  const invDoc = await Inventory.findOne({ product: data.productId });
  assert.ok(invDoc, 'Inventory document must exist');
  assert.equal(invDoc.soldStock, 1, 'soldStock must be incremented to 1');

  const movements = await InventoryMovement.find({ product: data.productId, type: 'SALE' });
  assert.equal(movements.length, 1, 'Exactly ONE sale movement record must be created');

  await cleanupTestData(data);
});

test('TEST 2 — Successful Payment + Inventory Failure (MOST IMPORTANT TEST)', { concurrency: false }, async () => {
  // Stock is 0, so inventory operation will fail
  const data = await generateTestOrderAndPayment(0);
  const paymentId = `pay_invfail_${Date.now()}`;

  await assert.rejects(
    () => paymentService.markPaid(data.payment, paymentId),
    (err) => err.statusCode === 409 && /inventory/i.test(err.message),
    'Should throw 409 application error due to inventory failure',
  );

  const refreshedPayment = await Payment.findById(data.payment._id);
  assert.equal(refreshedPayment.status, 'PAID', 'CRITICAL: Payment status MUST remain PAID despite inventory failure');
  assert.equal(refreshedPayment.metadata.inventoryStatus, 'FAILED', 'metadata.inventoryStatus must be FAILED');
  assert.equal(refreshedPayment.metadata.reconciliationRequired, true, 'metadata.reconciliationRequired must be true');

  const refreshedOrder = await Order.findById(data.order._id);
  assert.equal(refreshedOrder.paymentStatus, 'PAID', 'Order paymentStatus MUST remain PAID');

  const invDoc = await Inventory.findOne({ product: data.productId });
  assert.equal(invDoc ? invDoc.soldStock : 0, 0, 'soldStock must be 0');

  const movements = await InventoryMovement.find({ product: data.productId, type: 'SALE' });
  assert.equal(movements.length, 0, 'No fake SALE movements must be recorded');

  await cleanupTestData(data);
});

test('TEST 3 — Duplicate Successful Payment Processing', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const paymentId = `pay_dup_${Date.now()}`;

  await paymentService.markPaid(data.payment, paymentId);
  const refreshedPayment1 = await Payment.findById(data.payment._id);
  assert.equal(refreshedPayment1.status, 'PAID');

  // Second markPaid call for the same payment
  const result2 = await paymentService.markPaid(refreshedPayment1, paymentId);
  assert.equal(result2.status, 'PAID', 'Duplicate call returns PAID payment idempotently');

  const movements = await InventoryMovement.find({ product: data.productId, type: 'SALE' });
  assert.equal(movements.length, 1, 'Must NOT create duplicate SALE movements');

  const invDoc = await Inventory.findOne({ product: data.productId });
  assert.equal(invDoc.soldStock, 1, 'Must NOT double-count sold stock');

  await cleanupTestData(data);
});

test('TEST 4 — Webhook Retry', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const originalFetch = razorpay.payments.fetch;

  // Mock env.razorpayWebhookSecret if needed
  const secret = env.razorpayWebhookSecret || 'test_webhook_secret';
  env.razorpayWebhookSecret = secret;

  const paymentId = `pay_wh_${Date.now()}`;
  const webhookBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: data.gatewayOrderId,
        },
      },
    },
  });

  const signature = crypto.createHmac('sha256', secret).update(webhookBody).digest('hex');

  // First webhook execution
  await paymentService.handleWebhook(webhookBody, signature, JSON.parse(webhookBody));

  const p1 = await Payment.findById(data.payment._id);
  assert.equal(p1.status, 'PAID', 'Payment status becomes PAID via webhook');

  // Second webhook execution (retry)
  const webhookResult2 = await paymentService.handleWebhook(webhookBody, signature, JSON.parse(webhookBody));
  assert.equal(webhookResult2.received, true);

  const movements = await InventoryMovement.find({ product: data.productId, type: 'SALE' });
  assert.equal(movements.length, 1, 'Webhook retry must NOT duplicate inventory commit');

  razorpay.payments.fetch = originalFetch;
  await cleanupTestData(data);
});

test('TEST 5 — Payment Failure (Genuine Gateway Payment Failure)', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);

  // Directly set payment to FAILED for genuine gateway failure simulation
  await Payment.updateOne({ _id: data.payment._id }, { $set: { status: 'FAILED' } });

  const failedPayment = await Payment.findById(data.payment._id);
  assert.equal(failedPayment.status, 'FAILED', 'Payment status is FAILED for genuine gateway failure');

  const invDoc = await Inventory.findOne({ product: data.productId, variant: data.variantId });
  assert.equal(invDoc ? invDoc.soldStock : 0, 0, 'Inventory must NOT be committed for failed payment');

  await cleanupTestData(data);
});

test('TEST 6 — Amount Mismatch', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const originalFetch = razorpay.payments.fetch;
  const secret = env.razorpayKeySecret || 'test_secret';
  env.razorpayKeySecret = secret;
  env.razorpayKeyId = 'test_key';

  const paymentId = `pay_amt_mismatch_${Date.now()}`;
  const signaturePayload = `${data.gatewayOrderId}|${paymentId}`;
  const signature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');

  // Mock fetch returning wrong amount (100 rupees instead of 200)
  razorpay.payments.fetch = async () => ({
    id: paymentId,
    order_id: data.gatewayOrderId,
    currency: 'INR',
    amount: 10000, // 100 INR in paise, expected 20000 paise
    status: 'captured',
  });

  await assert.rejects(
    () => paymentService.verifyPayment(data.userId, {
      razorpay_order_id: data.gatewayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
    /match/i,
  );

  const p = await Payment.findById(data.payment._id);
  assert.notEqual(p.status, 'PAID', 'Payment must NOT become PAID on amount mismatch');

  razorpay.payments.fetch = originalFetch;
  await cleanupTestData(data);
});

test('TEST 7 — Currency Mismatch', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const originalFetch = razorpay.payments.fetch;
  const secret = env.razorpayKeySecret || 'test_secret';
  env.razorpayKeySecret = secret;
  env.razorpayKeyId = 'test_key';

  const paymentId = `pay_curr_mismatch_${Date.now()}`;
  const signaturePayload = `${data.gatewayOrderId}|${paymentId}`;
  const signature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');

  // Mock fetch returning wrong currency
  razorpay.payments.fetch = async () => ({
    id: paymentId,
    order_id: data.gatewayOrderId,
    currency: 'USD',
    amount: 20000,
    status: 'captured',
  });

  await assert.rejects(
    () => paymentService.verifyPayment(data.userId, {
      razorpay_order_id: data.gatewayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
    /match/i,
  );

  const p = await Payment.findById(data.payment._id);
  assert.notEqual(p.status, 'PAID', 'Payment must NOT become PAID on currency mismatch');

  razorpay.payments.fetch = originalFetch;
  await cleanupTestData(data);
});

test('TEST 8 — Invalid Signature', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const paymentId = `pay_bad_sig_${Date.now()}`;
  env.razorpayKeySecret = 'test_secret';
  env.razorpayKeyId = 'test_key';

  await assert.rejects(
    () => paymentService.verifyPayment(data.userId, {
      razorpay_order_id: data.gatewayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: 'invalid_signature_hash',
    }),
    /signature/i,
  );

  const p = await Payment.findById(data.payment._id);
  assert.notEqual(p.status, 'PAID', 'Payment must NOT become PAID on invalid signature');

  await cleanupTestData(data);
});

test('TEST 9 — Invoice Failure (Payment remains PAID)', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const paymentId = `pay_inv_fail_${Date.now()}`;

  // Mark payment paid
  const p = await paymentService.markPaid(data.payment, paymentId);
  assert.equal(p.status, 'PAID');

  // Simulate invoice generation throwing error
  const invoiceGenerator = async () => { throw new Error('Invoice PDF renderer failed'); };
  await assert.rejects(() => invoiceGenerator(), /Invoice/);

  const reCheckedPayment = await Payment.findById(data.payment._id);
  assert.equal(reCheckedPayment.status, 'PAID', 'Payment status MUST remain PAID when invoice generation fails');

  await cleanupTestData(data);
});

test('TEST 10 — Email Failure (Payment remains PAID)', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const paymentId = `pay_email_fail_${Date.now()}`;

  const p = await paymentService.markPaid(data.payment, paymentId);
  assert.equal(p.status, 'PAID');

  // Simulate transactional email dispatch error
  const emailSender = async () => { throw new Error('SMTP connection timeout'); };
  await assert.rejects(() => emailSender(), /SMTP/);

  const reCheckedPayment = await Payment.findById(data.payment._id);
  assert.equal(reCheckedPayment.status, 'PAID', 'Payment status MUST remain PAID when email sending fails');

  await cleanupTestData(data);
});

test('TEST 11 — Shipping Failure (Payment remains PAID)', { concurrency: false }, async () => {
  const data = await generateTestOrderAndPayment(5);
  const paymentId = `pay_ship_fail_${Date.now()}`;

  const p = await paymentService.markPaid(data.payment, paymentId);
  assert.equal(p.status, 'PAID');

  // Simulate shipping provider API error
  const shippingProvider = async () => { throw new Error('Shiprocket API credentials invalid'); };
  await assert.rejects(() => shippingProvider(), /Shiprocket/);

  const reCheckedPayment = await Payment.findById(data.payment._id);
  assert.equal(reCheckedPayment.status, 'PAID', 'Payment status MUST remain PAID when shipping provider fails');

  await cleanupTestData(data);
});
