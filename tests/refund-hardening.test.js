import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { razorpay } from '../src/config/payment.js';
import User from '../src/modules/users/model.js';
import Order from '../src/modules/orders/model.js';
import Payment from '../src/modules/payments/model.js';
import Refund from '../src/modules/payments/refund.model.js';
import PaymentWebhookEvent from '../src/modules/payments/webhook.model.js';
import { refundService } from '../src/modules/payments/refund.service.js';
import { paymentService } from '../src/modules/payments/service.js';

const originalRefund = razorpay.payments.refund;

const makeFixture = async ({ paymentStatus = 'PAID', refundAmount = 0, amount = 200 } = {}) => {
  const user = await User.create({
    firstName: 'Refund',
    lastName: 'User',
    email: `refund-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'hashed-password',
  });
  const order = await Order.create({
    user: user._id,
    orderNumber: `RF-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    items: [{
      productId: new mongoose.Types.ObjectId(),
      variantId: new mongoose.Types.ObjectId(),
      productName: 'Refund Shoe',
      sku: `RF-${Date.now()}`,
      size: 'US 9',
      color: 'Black',
      quantity: 1,
      unitPrice: amount,
      finalPrice: amount,
    }],
    shippingAddress: { addressLine1: '123 Main', city: 'Mumbai', country: 'India' },
    customerSnapshot: { firstName: 'Refund', lastName: 'User', email: user.email },
    subtotal: amount,
    grandTotal: amount,
    status: paymentStatus === 'PAID' ? 'CONFIRMED' : 'PENDING',
    paymentStatus,
    paymentId: paymentStatus === 'PAID' ? `pay_${Date.now()}` : '',
  });
  const payment = await Payment.create({
    order: order._id,
    user: user._id,
    gateway: 'RAZORPAY',
    gatewayOrderId: `order_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    paymentId: paymentStatus === 'PAID' ? order.paymentId : '',
    amount,
    currency: 'INR',
    status: paymentStatus,
    refundAmount,
    refundStatus: refundAmount >= amount ? 'COMPLETED' : 'NONE',
  });
  return { user, order, payment };
};

const cleanup = async (fixture) => {
  await Refund.deleteMany({ order: fixture?.order?._id }).catch(() => {});
  await PaymentWebhookEvent.deleteMany({}).catch(() => {});
  if (fixture?.payment) await Payment.deleteOne({ _id: fixture.payment._id }).catch(() => {});
  if (fixture?.order) await Order.deleteOne({ _id: fixture.order._id }).catch(() => {});
  if (fixture?.user) await User.deleteOne({ _id: fixture.user._id }).catch(() => {});
};

const sign = (body) => crypto.createHmac('sha256', env.razorpayWebhookSecret).update(body).digest('hex');

test.before(async () => {
  await connectDatabase();
  env.razorpayKeyId = 'rzp_test_key';
  env.razorpayKeySecret = 'rzp_test_secret';
  env.razorpayWebhookSecret = 'refund_webhook_secret';
});

test.after(async () => {
  razorpay.payments.refund = originalRefund;
  await closeDatabase();
});

test('refund: valid full refund updates payment and order after gateway success', async () => {
  const fixture = await makeFixture();
  razorpay.payments.refund = async (paymentId, payload) => ({ id: `rfnd_${Date.now()}`, payment_id: paymentId, amount: payload.amount, currency: 'INR', status: 'processed' });

  const result = await refundService.refund(fixture.order._id, new mongoose.Types.ObjectId(), undefined, { idempotencyKey: 'full-refund' });

  assert.equal(result.payment.status, 'REFUNDED');
  assert.equal(result.payment.refundAmount, 200);
  assert.equal((await Order.findById(fixture.order._id)).paymentStatus, 'REFUNDED');
  assert.equal((await Refund.findOne({ order: fixture.order._id })).status, 'COMPLETED');
  await cleanup(fixture);
});

test('refund: valid partial refund never marks payment fully refunded', async () => {
  const fixture = await makeFixture();
  razorpay.payments.refund = async (paymentId, payload) => ({ id: `rfnd_partial_${Date.now()}`, payment_id: paymentId, amount: payload.amount, currency: 'INR', status: 'processed' });

  const result = await refundService.refund(fixture.order._id, new mongoose.Types.ObjectId(), 75, { idempotencyKey: 'partial-refund' });

  assert.equal(result.payment.status, 'PAID');
  assert.equal(result.payment.refundAmount, 75);
  assert.equal((await Order.findById(fixture.order._id)).paymentStatus, 'PAID');
  await cleanup(fixture);
});

test('refund: rejects invalid amount, unpaid payment, and already fully refunded payment', async () => {
  const paid = await makeFixture();
  await assert.rejects(() => refundService.refund(paid.order._id, new mongoose.Types.ObjectId(), 500), /Invalid refund amount/);
  await assert.rejects(() => refundService.refund(paid.order._id, new mongoose.Types.ObjectId(), 0), /Invalid refund amount/);
  await cleanup(paid);

  const unpaid = await makeFixture({ paymentStatus: 'PENDING' });
  await assert.rejects(() => refundService.refund(unpaid.order._id, new mongoose.Types.ObjectId(), 10), /successful payment/);
  await cleanup(unpaid);

  const refunded = await makeFixture({ refundAmount: 200 });
  await Payment.updateOne({ _id: refunded.payment._id }, { $set: { status: 'REFUNDED' } });
  await assert.rejects(() => refundService.refund(refunded.order._id, new mongoose.Types.ObjectId(), 10), /successful payment|fully refunded/);
  await cleanup(refunded);
});

test('refund: duplicate and concurrent duplicate requests create one gateway refund', async () => {
  const fixture = await makeFixture();
  let gatewayCalls = 0;
  razorpay.payments.refund = async (paymentId, payload) => {
    gatewayCalls += 1;
    await new Promise((resolve) => { setTimeout(resolve, 25); });
    return { id: 'rfnd_dedupe', payment_id: paymentId, amount: payload.amount, currency: 'INR', status: 'processed' };
  };

  const results = await Promise.all([
    refundService.refund(fixture.order._id, new mongoose.Types.ObjectId(), 50, { idempotencyKey: 'same-refund' }),
    refundService.refund(fixture.order._id, new mongoose.Types.ObjectId(), 50, { idempotencyKey: 'same-refund' }),
    refundService.refund(fixture.order._id, new mongoose.Types.ObjectId(), 50, { idempotencyKey: 'same-refund' }),
  ]);

  assert.equal(gatewayCalls, 1);
  assert.equal(results.length, 3);
  assert.equal(await Refund.countDocuments({ order: fixture.order._id }), 1);
  assert.equal((await Payment.findById(fixture.payment._id)).refundAmount, 50);
  await cleanup(fixture);
});

test('refund: gateway failure does not falsely mark payment refunded', async () => {
  const fixture = await makeFixture();
  razorpay.payments.refund = async () => { throw new Error('gateway unavailable'); };

  await assert.rejects(() => refundService.refund(fixture.order._id, new mongoose.Types.ObjectId(), 40, { idempotencyKey: 'gateway-fail' }), /gateway unavailable/);

  const payment = await Payment.findById(fixture.payment._id);
  const refund = await Refund.findOne({ order: fixture.order._id });
  assert.equal(payment.status, 'PAID');
  assert.equal(payment.refundStatus, 'FAILED');
  assert.equal(refund.status, 'FAILED');
  await cleanup(fixture);
});

test('refund webhook: completes processing refund idempotently and never downgrades completed refund', async () => {
  const fixture = await makeFixture();
  const refund = await Refund.create({
    order: fixture.order._id,
    payment: fixture.payment._id,
    provider: 'RAZORPAY',
    idempotencyKey: 'webhook-complete',
    gatewayRefundId: 'rfnd_webhook',
    gatewayPaymentId: fixture.payment.paymentId,
    amount: 200,
    currency: 'INR',
    status: 'PROCESSING',
  });
  await Payment.updateOne({ _id: fixture.payment._id }, { $set: { refundStatus: 'PROCESSING' } });

  const payload = { event: 'refund.processed', event_id: `evt_refund_${Date.now()}`, payload: { refund: { entity: { id: refund.gatewayRefundId, payment_id: fixture.payment.paymentId, amount: 20000, currency: 'INR', status: 'processed' } } } };
  const rawBody = JSON.stringify(payload);
  const signature = sign(rawBody);

  const first = await paymentService.handleWebhook(rawBody, signature, payload);
  const second = await paymentService.handleWebhook(rawBody, signature, payload);

  assert.equal(first.received, true);
  assert.equal(second.duplicate, true);
  assert.equal((await Payment.findById(fixture.payment._id)).status, 'REFUNDED');
  assert.equal((await Refund.findById(refund._id)).status, 'COMPLETED');

  const failedPayload = { event: 'refund.failed', event_id: `evt_refund_failed_${Date.now()}`, payload: { refund: { entity: { id: refund.gatewayRefundId, payment_id: fixture.payment.paymentId, amount: 20000, currency: 'INR', status: 'failed' } } } };
  const failedRaw = JSON.stringify(failedPayload);
  await paymentService.handleWebhook(failedRaw, sign(failedRaw), failedPayload);
  assert.equal((await Refund.findById(refund._id)).status, 'COMPLETED');
  await cleanup(fixture);
});

test('refund: invalid state transition is rejected', async () => {
  const fixture = await makeFixture();
  const refund = await Refund.create({
    order: fixture.order._id,
    payment: fixture.payment._id,
    provider: 'RAZORPAY',
    idempotencyKey: 'bad-transition',
    gatewayPaymentId: fixture.payment.paymentId,
    amount: 20,
    currency: 'INR',
    status: 'FAILED',
  });

  await assert.rejects(() => refundService.completeRefund(refund._id, { id: 'rfnd_bad', payment_id: fixture.payment.paymentId, amount: 2000, currency: 'INR', status: 'processed' }), /Invalid refund state transition/);
  await cleanup(fixture);
});
