import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { shippingConfig } from '../src/config/shipping.js';
import User from '../src/modules/users/model.js';
import Order from '../src/modules/orders/model.js';
import Shipment from '../src/modules/shipments/model.js';
import ShipmentWebhookEvent from '../src/modules/shipments/webhook.model.js';
import { shipmentService } from '../src/modules/shipments/service.js';

const originalFetch = global.fetch;
const originalConfig = { ...shippingConfig };

const makeOrder = async ({ status = 'CONFIRMED', paymentStatus = 'PAID' } = {}) => {
  const user = await User.create({
    firstName: 'Ship',
    lastName: 'User',
    email: `ship-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'hashed-password',
    phone: '9999999999',
  });
  const order = await Order.create({
    user: user._id,
    orderNumber: `SHIP-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    items: [{
      productId: new mongoose.Types.ObjectId(),
      variantId: new mongoose.Types.ObjectId(),
      productName: 'Shipping Shoe',
      sku: `SHIP-${Date.now()}`,
      size: 'US 9',
      color: 'Black',
      quantity: 1,
      unitPrice: 150,
      finalPrice: 150,
    }],
    shippingAddress: { addressLine1: '123 Main', city: 'Mumbai', state: 'MH', postalCode: '400001', country: 'India' },
    customerSnapshot: { firstName: 'Ship', lastName: 'User', email: user.email },
    subtotal: 150,
    grandTotal: 150,
    status,
    paymentStatus,
  });
  return { user, order };
};

const cleanup = async (fixture) => {
  await Shipment.deleteMany({ order: fixture?.order?._id }).catch(() => {});
  await ShipmentWebhookEvent.deleteMany({}).catch(() => {});
  if (fixture?.order) await Order.deleteOne({ _id: fixture.order._id }).catch(() => {});
  if (fixture?.user) await User.deleteOne({ _id: fixture.user._id }).catch(() => {});
};

const configureShipping = () => {
  shippingConfig.provider = 'shiprocket';
  shippingConfig.apiKey = 'shiprocket-user';
  shippingConfig.apiSecret = 'shiprocket-pass';
  shippingConfig.pickupLocation = 'Warehouse A';
  shippingConfig.webhookSecret = 'shipping_webhook_secret';
};

const mockShiprocketSuccess = () => {
  let createCalls = 0;
  global.fetch = async (url) => {
    if (String(url).includes('/auth/login')) {
      return { ok: true, json: async () => ({ token: 'token' }) };
    }
    createCalls += 1;
    await new Promise((resolve) => { setTimeout(resolve, 25); });
    return { ok: true, json: async () => ({ shipment_id: 'ship_123', awb_code: 'awb_123', status: 'created' }) };
  };
  return () => createCalls;
};

const sign = (body) => crypto.createHmac('sha256', shippingConfig.webhookSecret).update(body).digest('hex');

test.before(async () => {
  await connectDatabase();
  configureShipping();
});

test.after(async () => {
  global.fetch = originalFetch;
  Object.assign(shippingConfig, originalConfig);
  await closeDatabase();
});

test('shipping: successful shipment creation persists provider data and ships order', async () => {
  const fixture = await makeOrder();
  const calls = mockShiprocketSuccess();

  const shipment = await shipmentService.createForOrder(fixture.order._id);

  assert.equal(calls(), 1);
  assert.equal(shipment.status, 'AWB_ASSIGNED');
  assert.equal(shipment.awb, 'awb_123');
  assert.equal((await Order.findById(fixture.order._id)).status, 'SHIPPED');
  await cleanup(fixture);
});

test('shipping: invalid and unpaid orders are rejected before provider call', async () => {
  const unpaid = await makeOrder({ paymentStatus: 'PENDING', status: 'PENDING' });
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error('should not call provider'); };

  await assert.rejects(() => shipmentService.createForOrder(unpaid.order._id), /eligible/);
  assert.equal(calls, 0);
  await cleanup(unpaid);

  await assert.rejects(() => shipmentService.createForOrder(new mongoose.Types.ObjectId()), /Order not found/);
});

test('shipping: duplicate and concurrent duplicate shipment requests create one provider shipment', async () => {
  const fixture = await makeOrder();
  const calls = mockShiprocketSuccess();

  const results = await Promise.all([
    shipmentService.createForOrder(fixture.order._id),
    shipmentService.createForOrder(fixture.order._id),
    shipmentService.createForOrder(fixture.order._id),
  ]);

  assert.equal(calls(), 1);
  assert.equal(results.length, 3);
  assert.equal(await Shipment.countDocuments({ order: fixture.order._id }), 1);
  await cleanup(fixture);
});

test('shipping: provider failure does not falsely ship order and allows retry state', async () => {
  const fixture = await makeOrder();
  global.fetch = async (url) => {
    if (String(url).includes('/auth/login')) return { ok: true, json: async () => ({ token: 'token' }) };
    return { ok: false, json: async () => ({ error: 'bad request' }) };
  };

  await assert.rejects(() => shipmentService.createForOrder(fixture.order._id), /rejected/);

  assert.equal((await Order.findById(fixture.order._id)).status, 'CONFIRMED');
  assert.equal((await Shipment.findOne({ order: fixture.order._id })).status, 'FAILED');
  await cleanup(fixture);
});

test('shipping webhook: duplicate delivery is harmless and backward transition is ignored', async () => {
  const fixture = await makeOrder({ status: 'SHIPPED' });
  const shipment = await Shipment.create({
    order: fixture.order._id,
    provider: 'shiprocket',
    shipmentId: 'ship_webhook',
    awb: 'awb_webhook',
    trackingUrl: 'https://shiprocket.co/tracking/awb_webhook',
    status: 'SHIPPED',
  });

  const payload = { event_id: `ship_evt_${Date.now()}`, shipment_id: shipment.shipmentId, awb: shipment.awb, current_status: 'DELIVERED' };
  const rawBody = JSON.stringify(payload);
  const first = await shipmentService.handleWebhook(rawBody, sign(rawBody), payload);
  const second = await shipmentService.handleWebhook(rawBody, sign(rawBody), payload);

  assert.equal(first.received, true);
  assert.equal(second.duplicate, true);
  assert.equal((await Shipment.findById(shipment._id)).status, 'DELIVERED');
  assert.equal((await Order.findById(fixture.order._id)).status, 'DELIVERED');

  const stalePayload = { event_id: `ship_evt_stale_${Date.now()}`, shipment_id: shipment.shipmentId, awb: shipment.awb, current_status: 'CREATED' };
  const staleRaw = JSON.stringify(stalePayload);
  const stale = await shipmentService.handleWebhook(staleRaw, sign(staleRaw), stalePayload);
  assert.equal(stale.ignored, true);
  assert.equal((await Shipment.findById(shipment._id)).status, 'DELIVERED');
  await cleanup(fixture);
});

test('shipping webhook and tracking: invalid webhook rejected and customer tracking hides provider raw payload', async () => {
  const fixture = await makeOrder({ status: 'SHIPPED' });
  await Shipment.create({
    order: fixture.order._id,
    provider: 'shiprocket',
    shipmentId: 'ship_safe',
    awb: 'awb_safe',
    trackingUrl: 'https://shiprocket.co/tracking/awb_safe',
    status: 'SHIPPED',
    raw: { token: 'secret-like-provider-field' },
  });

  const payload = { event_id: `bad_sig_${Date.now()}`, shipment_id: 'ship_safe', current_status: 'DELIVERED' };
  await assert.rejects(() => shipmentService.handleWebhook(JSON.stringify(payload), 'bad-signature', payload), /signature/);

  const tracking = await shipmentService.getForCustomer(fixture.order._id, fixture.user._id);
  assert.equal(tracking.awb, 'awb_safe');
  assert.equal(Object.prototype.hasOwnProperty.call(tracking, 'raw'), false);
  await cleanup(fixture);
});
