import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import Product from '../src/modules/products/model.js';
import Order from '../src/modules/orders/model.js';
import Payment from '../src/modules/payments/model.js';
import PaymentWebhookEvent from '../src/modules/payments/webhook.model.js';
import { paymentService } from '../src/modules/payments/service.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { inventoryService } from '../src/modules/inventory/service.js';

const makeWebhookEvent = ({ eventId, event = 'payment.captured', paymentId = 'pay_test_123', orderId = 'order_test_123', amount = 20000, status = 'captured' } = {}) => ({
  event,
  event_id: eventId,
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: orderId,
        amount,
        currency: 'INR',
        status,
      },
    },
  },
});

const createPaymentFixture = async (stockQty = 5) => {
  const userId = new mongoose.Types.ObjectId();
  const sku = `WEBHOOK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const product = await Product.create({
    name: `Webhook Product ${Date.now()}`,
    slug: `webhook-product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    price: 200,
    status: 'PUBLISHED',
    variants: [{ sku, size: 'US 9', color: 'Black', price: 200, stock: stockQty }],
  });

  const productId = product._id;
  const variantId = product.variants[0]._id;

  const order = await Order.create({
    user: userId,
    orderNumber: `WH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  const gatewayOrderId = `order_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

const cleanupFixture = async ({ productId, variantId, order, payment }) => {
  if (productId) {
    await Product.deleteOne({ _id: productId }).catch(() => {});
    await Inventory.deleteOne({ product: productId, variant: variantId }).catch(() => {});
    await InventoryMovement.deleteMany({ product: productId, variant: variantId }).catch(() => {});
  }
  if (order) await Order.deleteOne({ _id: order._id }).catch(() => {});
  if (payment) await Payment.deleteOne({ _id: payment._id }).catch(() => {});
};

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

test('webhook: missing signature rejected', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_missing_sig_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId: `pay_missing_${Date.now()}` });

  await assert.rejects(
    () => paymentService.handleWebhook(JSON.stringify(payload), undefined, payload),
    (err) => err.statusCode === 400 && /signature/i.test(err.message),
  );

  await cleanupFixture(fixture);
});

test('webhook: invalid signature rejected', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_bad_sig_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId: `pay_bad_sig_${Date.now()}` });
  const rawBody = JSON.stringify(payload);

  env.razorpayWebhookSecret = 'test_secret';
  await assert.rejects(
    () => paymentService.handleWebhook(rawBody, 'bad_signature', payload),
    (err) => err.statusCode === 400 && /signature/i.test(err.message),
  );

  await cleanupFixture(fixture);
});

test('webhook: valid signature succeeds and records event', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_valid_${Date.now()}`;
  const paymentId = `pay_valid_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId });
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  const result = await paymentService.handleWebhook(rawBody, signature, payload);
  assert.equal(result.received, true);

  const payment = await Payment.findById(fixture.payment._id);
  assert.equal(payment.status, 'PAID');

  const eventRecord = await PaymentWebhookEvent.findOne({ gateway: 'RAZORPAY', eventId });
  assert.ok(eventRecord);
  assert.equal(eventRecord.status, 'PROCESSED');

  const movementCount = await InventoryMovement.countDocuments({ product: fixture.productId, type: 'SALE' });
  assert.equal(movementCount, 1);

  await cleanupFixture(fixture);
});

test('webhook: duplicate delivery is idempotent', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_dup_${Date.now()}`;
  const paymentId = `pay_dup_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId });
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  await paymentService.handleWebhook(rawBody, signature, payload);
  const firstPayment = await Payment.findById(fixture.payment._id);
  const beforeCount = await InventoryMovement.countDocuments({ product: fixture.productId, type: 'SALE' });

  const result = await paymentService.handleWebhook(rawBody, signature, payload);

  assert.equal(result.received, true);
  assert.equal(result.duplicate, true);
  assert.equal((await Payment.findById(fixture.payment._id)).status, 'PAID');
  assert.equal((await InventoryMovement.countDocuments({ product: fixture.productId, type: 'SALE' })), beforeCount);
  assert.equal(firstPayment.status, 'PAID');

  await cleanupFixture(fixture);
});

test('webhook: concurrent duplicate delivery creates one side effect', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_concurrent_${Date.now()}`;
  const paymentId = `pay_concurrent_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId });
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  const results = await Promise.all([
    paymentService.handleWebhook(rawBody, signature, payload),
    paymentService.handleWebhook(rawBody, signature, payload),
    paymentService.handleWebhook(rawBody, signature, payload),
    paymentService.handleWebhook(rawBody, signature, payload),
  ]);

  assert.equal(results.filter((item) => item && item.received).length, 4);
  assert.equal(await PaymentWebhookEvent.countDocuments({ gateway: 'RAZORPAY', eventId }), 1);
  assert.equal((await Payment.findById(fixture.payment._id)).status, 'PAID');
  assert.equal(await InventoryMovement.countDocuments({ product: fixture.productId, type: 'SALE' }), 1);

  await cleanupFixture(fixture);
});

test('webhook: same eventId with different payload is rejected', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_conflict_${Date.now()}`;
  const basePayload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId: `pay_conflict_${Date.now()}` });
  const payloadA = JSON.stringify(basePayload);
  const payloadB = JSON.stringify({ ...basePayload, payload: { payment: { entity: { ...basePayload.payload.payment.entity, id: 'pay_conflict_other' } } } });
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const sigA = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(payloadA).digest('hex');
  const sigB = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(payloadB).digest('hex');

  await paymentService.handleWebhook(payloadA, sigA, basePayload);
  await assert.rejects(
    () => paymentService.handleWebhook(payloadB, sigB, JSON.parse(payloadB)),
    (err) => err.statusCode === 409 && /payload/i.test(err.message),
  );

  await cleanupFixture(fixture);
});

test('webhook: failed processing followed by retry succeeds', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_retry_fail_${Date.now()}`;
  const firstPaymentId = `pay_retry_1_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId: firstPaymentId });
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  const originalCommitSale = inventoryService.commitSale;
  let attempt = 0;
  inventoryService.commitSale = async (...args) => {
    attempt += 1;
    if (attempt === 1) {
      throw new Error('temporary inventory failure');
    }
    return originalCommitSale(...args);
  };

  try {
    const firstResult = await paymentService.handleWebhook(rawBody, signature, payload);
    assert.equal(firstResult.received, true);
    assert.equal(firstResult.status, 'FAILED');

    const afterFailure = await PaymentWebhookEvent.findOne({ gateway: 'RAZORPAY', eventId });
    assert.equal(afterFailure.status, 'FAILED');

    const secondResult = await paymentService.handleWebhook(rawBody, signature, payload);
    assert.equal(secondResult.received, true);
    assert.equal((await Payment.findById(fixture.payment._id)).status, 'PAID');
    assert.equal((await PaymentWebhookEvent.findOne({ gateway: 'RAZORPAY', eventId })).status, 'PROCESSED');
  } finally {
    inventoryService.commitSale = originalCommitSale;
    await cleanupFixture(fixture);
  }
});

test('webhook: stale processing can be retried', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_stale_${Date.now()}`;
  const paymentId = `pay_stale_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId });
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  const event = await PaymentWebhookEvent.create({
    gateway: 'RAZORPAY',
    eventId,
    eventType: 'payment.captured',
    status: 'PROCESSING',
    payloadHash: crypto.createHash('sha256').update(rawBody).digest('hex'),
    attempts: 1,
    updatedAt: new Date(Date.now() - 1000 * 60 * 15),
  });

  const result = await paymentService.handleWebhook(rawBody, signature, payload);
  assert.equal(result.received, true);
  assert.equal(result.status, 'PROCESSED');
  assert.equal((await PaymentWebhookEvent.findById(event._id)).status, 'PROCESSED');

  await cleanupFixture(fixture);
});

test('webhook: unsupported event is acknowledged without side effect', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_unsupported_${Date.now()}`;
  const payload = { event: 'refund.created', event_id: eventId, payload: { refund: { entity: { id: 'rfnd_123', payment_id: 'pay_123' } } } };
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  const result = await paymentService.handleWebhook(rawBody, signature, payload);
  assert.equal(result.received, true);
  assert.equal(result.ignored, true);

  const eventRecord = await PaymentWebhookEvent.findOne({ gateway: 'RAZORPAY', eventId });
  assert.ok(eventRecord);
  assert.equal(eventRecord.status, 'PROCESSED');

  await cleanupFixture(fixture);
});

test('webhook: payment already PAID is not downgraded', async () => {
  const fixture = await createPaymentFixture();
  const paymentId = `pay_already_paid_${Date.now()}`;
  await Payment.updateOne({ _id: fixture.payment._id }, { $set: { status: 'PAID', paymentId } });

  const eventId = `evt_paid_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId });
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  const result = await paymentService.handleWebhook(rawBody, signature, payload);
  assert.equal(result.received, true);
  assert.equal((await Payment.findById(fixture.payment._id)).status, 'PAID');

  await cleanupFixture(fixture);
});

test('webhook: inventory side effect remains idempotent on repeated event', async () => {
  const fixture = await createPaymentFixture();
  const eventId = `evt_inv_idem_${Date.now()}`;
  const paymentId = `pay_inv_idem_${Date.now()}`;
  const payload = makeWebhookEvent({ eventId, orderId: fixture.gatewayOrderId, paymentId });
  const rawBody = JSON.stringify(payload);
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  await paymentService.handleWebhook(rawBody, signature, payload);
  const firstMoves = await InventoryMovement.countDocuments({ product: fixture.productId, type: 'SALE' });
  await paymentService.handleWebhook(rawBody, signature, payload);

  assert.equal(await InventoryMovement.countDocuments({ product: fixture.productId, type: 'SALE' }), firstMoves);
  await cleanupFixture(fixture);
});
