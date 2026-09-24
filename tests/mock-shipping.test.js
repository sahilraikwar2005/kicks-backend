import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { shippingConfig } from '../src/config/shipping.js';
import { env } from '../src/config/env.js';
import { transporter } from '../src/config/email.js';
import app from '../src/app.js';
import User from '../src/modules/users/model.js';
import Order from '../src/modules/orders/model.js';
import Product from '../src/modules/products/model.js';
import Shipment from '../src/modules/shipments/model.js';
import ShipmentWebhookEvent from '../src/modules/shipments/webhook.model.js';
import { InventoryMovement } from '../src/modules/inventory/model.js';
import { shipmentService } from '../src/modules/shipments/service.js';

// Mock-shipping workflow coverage. All fixtures use the mockt- prefix and are
// removed afterwards — shared development data is never touched. No test hits
// any real courier: the mock provider performs zero network calls.
const TAG = 'mockt';
const orderNo = (n) => `MOCKT-${n}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
const emailFor = (n) => `${TAG}-${n}-${Date.now()}@example.com`;

const originalProvider = shippingConfig.provider;
const originalMockFlag = shippingConfig.mockShippingEnabled;
const originalSendMail = transporter.sendMail;
const originalSmtpUser = env.smtpUser;
const originalSmtpPassword = env.smtpPassword;

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const apiBase = `http://127.0.0.1:${server.address().port}/api/v1`;

test.before(async () => {
  await connectDatabase();
  shippingConfig.provider = 'mock';
  shippingConfig.mockShippingEnabled = true;
  env.smtpUser = 'mock-user@example.com';
  env.smtpPassword = 'mock-password';
  transporter.sendMail = async () => ({ messageId: 'mock-mail' });
});

test.after(async () => {
  shippingConfig.provider = originalProvider;
  shippingConfig.mockShippingEnabled = originalMockFlag;
  transporter.sendMail = originalSendMail;
  env.smtpUser = originalSmtpUser;
  env.smtpPassword = originalSmtpPassword;
  await Shipment.deleteMany({ provider: 'MOCK' });
  await ShipmentWebhookEvent.deleteMany({ provider: 'MOCK' });
  await Order.deleteMany({ orderNumber: new RegExp(`^${TAG}`, 'i') });
  await User.deleteMany({ email: new RegExp(TAG, 'i') });
  await Product.deleteMany({ slug: new RegExp(TAG, 'i') });
  server.close();
  await closeDatabase();
});

const makeUser = (n, role = 'CUSTOMER') => User.create({
  firstName: 'Mock',
  lastName: `Tester${n}`,
  email: emailFor(n),
  password: bcrypt.hashSync('Customer123', 12),
  role,
});

const makeOrder = async (n, { status = 'PACKED', paymentStatus = 'PAID' } = {}) => {
  const user = await makeUser(n);
  const order = await Order.create({
    user: user._id,
    orderNumber: orderNo(n),
    items: [{
      productId: new mongoose.Types.ObjectId(),
      variantId: new mongoose.Types.ObjectId(),
      productName: 'Mock Runner',
      sku: `MOCKT-SKU-${n}`,
      size: 'UK 8',
      color: 'Black',
      quantity: 1,
      unitPrice: 2999,
      discount: 0,
      finalPrice: 2999,
    }],
    shippingAddress: { addressLine1: '221 Test Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'India', phone: '9876543210' },
    customerSnapshot: { firstName: 'Mock', lastName: `Tester${n}`, email: user.email, phone: '9876543210' },
    subtotal: 2999,
    grandTotal: 2999,
    status,
    paymentStatus,
  });
  return { user, order };
};

const cleanupOrder = async ({ user, order } = {}) => {
  if (order) {
    await Shipment.deleteMany({ order: order._id });
    await Order.deleteOne({ _id: order._id });
  }
  if (user) await User.deleteOne({ _id: user._id });
};

const loginCookie = async (email, password) => {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  const raw = response.headers.get('set-cookie') || '';
  const access = (raw.match(/accessToken=([^;]+)/) || [])[1] || '';
  return `accessToken=${access}`;
};

test('1/4/5/7: paid order creates a uniquely-identified mock shipment with label', async () => {
  const fixture = await makeOrder('c1');
  try {
    const shipment = await shipmentService.createForOrder(fixture.order._id);
    assert.equal(shipment.provider, 'MOCK');
    assert.equal(shipment.isTest, true);
    assert.match(shipment.shipmentId, /^MOCK-SHP-[0-9A-F]{8}$/);
    assert.match(shipment.awb, /^MOCK\d{10}$/);
    assert.equal(shipment.status, 'READY_FOR_PICKUP');
    assert.ok(shipment.labelHtml.includes('NOT FOR REAL SHIPPING'));
    assert.ok(shipment.labelHtml.includes(fixture.order.orderNumber));
    assert.ok(shipment.labelHtml.includes(shipment.awb));
    assert.ok(shipment.estimatedDeliveryDate);
    const untouched = await Order.findById(fixture.order._id);
    assert.equal(untouched.status, 'PACKED');

    const second = await makeOrder('c1b');
    try {
      const other = await shipmentService.createForOrder(second.order._id);
      assert.notEqual(other.shipmentId, shipment.shipmentId);
      assert.notEqual(other.awb, shipment.awb);
    } finally {
      await cleanupOrder(second);
    }
  } finally {
    await cleanupOrder(fixture);
  }
});

test('2/3: unpaid and cancelled orders cannot create shipments', async () => {
  const unpaid = await makeOrder('c2', { status: 'CONFIRMED', paymentStatus: 'PENDING' });
  try {
    await assert.rejects(() => shipmentService.createForOrder(unpaid.order._id), (error) => error.statusCode === 400);
    assert.equal(await Shipment.countDocuments({ order: unpaid.order._id }), 0);
  } finally {
    await cleanupOrder(unpaid);
  }
  const cancelled = await makeOrder('c3', { status: 'CANCELLED', paymentStatus: 'PAID' });
  try {
    await assert.rejects(() => shipmentService.createForOrder(cancelled.order._id), (error) => error.statusCode === 400);
  } finally {
    await cleanupOrder(cancelled);
  }
});

test('6: create shipment is idempotent', async () => {
  const fixture = await makeOrder('c6');
  try {
    const first = await shipmentService.createForOrder(fixture.order._id);
    const second = await shipmentService.createForOrder(fixture.order._id);
    assert.equal(String(second._id), String(first._id));
    assert.equal(second.awb, first.awb);
    assert.equal(await Shipment.countDocuments({ order: fixture.order._id }), 1);
  } finally {
    await cleanupOrder(fixture);
  }
});

test('8: pickup scheduling is explicit and idempotent', async () => {
  const fixture = await makeOrder('c8');
  try {
    await shipmentService.createForOrder(fixture.order._id);
    const created = await Shipment.findOne({ order: fixture.order._id });
    const first = await shipmentService.scheduleMockPickup(created._id);
    assert.match(first.pickup.requestId, /^MOCK-PCK-[0-9A-F]{8}$/);
    assert.equal(first.pickup.status, 'SCHEDULED');
    assert.equal(first.status, 'PICKUP_SCHEDULED');
    const second = await shipmentService.scheduleMockPickup(first._id);
    assert.equal(second.pickup.requestId, first.pickup.requestId);
  } finally {
    await cleanupOrder(fixture);
  }
});

test('9-12: full simulate lifecycle pickup → shipped → out-for-delivery → delivered', async () => {
  const fixture = await makeOrder('c9');
  try {
    const created = await shipmentService.createForOrder(fixture.order._id);
    const pickup = await shipmentService.scheduleMockPickup(created._id);

    const picked = await shipmentService.simulateMockEvent(pickup._id, 'pickup');
    assert.equal(picked.status, 'PICKED_UP');
    assert.equal((await Order.findById(fixture.order._id)).status, 'SHIPPED');

    const shipped = await shipmentService.simulateMockEvent(pickup._id, 'shipped');
    assert.equal(shipped.status, 'IN_TRANSIT');

    const ofd = await shipmentService.simulateMockEvent(pickup._id, 'out_for_delivery');
    assert.equal(ofd.status, 'OUT_FOR_DELIVERY');
    assert.equal((await Order.findById(fixture.order._id)).status, 'OUT_FOR_DELIVERY');

    const delivered = await shipmentService.simulateMockEvent(pickup._id, 'delivered');
    assert.equal(delivered.status, 'DELIVERED');
    assert.equal((await Order.findById(fixture.order._id)).status, 'DELIVERED');
  } finally {
    await cleanupOrder(fixture);
  }
});

test('13: invalid transitions are rejected', async () => {
  const fixture = await makeOrder('c13');
  try {
    const created = await shipmentService.createForOrder(fixture.order._id);
    await assert.rejects(() => shipmentService.simulateMockEvent(created._id, 'delivered'), (error) => error.statusCode === 400);
    await assert.rejects(() => shipmentService.simulateMockEvent(created._id, 'bogus-event'), (error) => error.statusCode === 400);
    assert.equal((await Shipment.findById(created._id)).status, 'READY_FOR_PICKUP');
  } finally {
    await cleanupOrder(fixture);
  }
});

test('14: duplicate delivered event has no side effects', async () => {
  const fixture = await makeOrder('c14');
  try {
    const created = await shipmentService.createForOrder(fixture.order._id);
    await shipmentService.simulateMockEvent(created._id, 'pickup');
    await shipmentService.simulateMockEvent(created._id, 'shipped');
    await shipmentService.simulateMockEvent(created._id, 'out_for_delivery');
    await shipmentService.simulateMockEvent(created._id, 'delivered');
    const replay = await shipmentService.simulateMockEvent(created._id, 'delivered');
    assert.equal(replay.duplicate, true);
    const shipment = await Shipment.findById(created._id);
    assert.equal(shipment.events.filter((event) => event.status === 'DELIVERED').length, 1);
    assert.equal((await Order.findById(fixture.order._id)).status, 'DELIVERED');
  } finally {
    await cleanupOrder(fixture);
  }
});

test('15-17: NDR retry loop, RTO flow and return keep the order safe', async () => {
  const fixture = await makeOrder('c15');
  try {
    const created = await shipmentService.createForOrder(fixture.order._id);
    await shipmentService.simulateMockEvent(created._id, 'pickup');
    await shipmentService.simulateMockEvent(created._id, 'shipped');
    await shipmentService.simulateMockEvent(created._id, 'out_for_delivery');

    const ndr = await shipmentService.simulateMockEvent(created._id, 'ndr');
    assert.equal(ndr.status, 'NDR');
    assert.equal((await Order.findById(fixture.order._id)).status, 'OUT_FOR_DELIVERY');

    const retry = await shipmentService.simulateMockEvent(created._id, 'out_for_delivery');
    assert.equal(retry.status, 'OUT_FOR_DELIVERY');

    await shipmentService.simulateMockEvent(created._id, 'ndr');
    const rto = await shipmentService.simulateMockEvent(created._id, 'rto');
    assert.equal(rto.status, 'RTO_INITIATED');
    const rtoTransit = await shipmentService.simulateMockEvent(created._id, 'rto_transit');
    assert.equal(rtoTransit.status, 'RTO_IN_TRANSIT');
    const returned = await shipmentService.simulateMockEvent(created._id, 'returned');
    assert.equal(returned.status, 'RETURNED');
    const order = await Order.findById(fixture.order._id);
    assert.ok(['OUT_FOR_DELIVERY', 'SHIPPED'].includes(order.status));
  } finally {
    await cleanupOrder(fixture);
  }
});

test('18/19: customer payload stays minimal, admin timeline stays complete', async () => {
  const fixture = await makeOrder('c18');
  try {
    const created = await shipmentService.createForOrder(fixture.order._id);
    await shipmentService.simulateMockEvent(created._id, 'pickup');
    const tracking = await shipmentService.getForCustomer(fixture.order._id, fixture.user._id);
    assert.ok(tracking);
    assert.equal(tracking.status, 'PICKED_UP');
    assert.ok(!('raw' in tracking) && !('metadata' in tracking) && !('labelHtml' in tracking));

    const details = await shipmentService.getAdminDetails(created._id);
    const chain = details.events.map((event) => event.status);
    for (const expected of ['PROCESSING', 'READY_FOR_PICKUP', 'AWB_ASSIGNED', 'PICKED_UP']) {
      assert.ok(chain.includes(expected), `timeline misses ${expected}`);
    }
    assert.ok(details.events.every((event) => event.occurredAt));
  } finally {
    await cleanupOrder(fixture);
  }
});

test('20: mock simulation is refused when the flag is off', async () => {
  const fixture = await makeOrder('c20');
  try {
    const created = await shipmentService.createForOrder(fixture.order._id);
    shippingConfig.mockShippingEnabled = false;
    try {
      await assert.rejects(() => shipmentService.simulateMockEvent(created._id, 'pickup'), (error) => error.statusCode === 503);
      await assert.rejects(() => shipmentService.scheduleMockPickup(created._id), (error) => error.statusCode === 503);
    } finally {
      shippingConfig.mockShippingEnabled = true;
    }
  } finally {
    await cleanupOrder(fixture);
  }
});

test('21: simulation endpoints require admin (401 anonymous, 403 customer)', async () => {
  const fixture = await makeOrder('c21');
  const customer = await makeUser('c21x');
  try {
    const shipment = await shipmentService.createForOrder(fixture.order._id);
    const customerCookie = await loginCookie(customer.email, 'Customer123');

    const forbidden = await fetch(`${apiBase}/admin/shipments/${shipment._id}/mock/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customerCookie },
      body: JSON.stringify({ event: 'pickup' }),
    });
    assert.equal(forbidden.status, 403);

    const anonymous = await fetch(`${apiBase}/admin/shipments/${shipment._id}/mock/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'pickup' }),
    });
    assert.equal(anonymous.status, 401);
  } finally {
    await User.deleteOne({ _id: customer._id });
    await cleanupOrder(fixture);
  }
});

test('22/23: shipping never touches stock or payment', async () => {
  const suffix = `mockt-stock-${Date.now()}`;
  const product = await Product.create({
    name: `Mock Ship Stock ${suffix}`,
    slug: `mockt-stock-${suffix}`.toLowerCase(),
    price: 1999,
    status: 'PUBLISHED',
    variants: [{ sku: `MOCKT-STK-${suffix}`.toUpperCase(), size: 'UK 9', color: 'White', price: 1999, stock: 10, images: [] }],
  });
  const fixture = await makeOrder('c22');
  try {
    const beforeStock = product.variants[0].stock;
    const beforePayments = (await Order.findById(fixture.order._id)).paymentStatus;
    const created = await shipmentService.createForOrder(fixture.order._id);
    await shipmentService.simulateMockEvent(created._id, 'pickup');
    await shipmentService.simulateMockEvent(created._id, 'shipped');
    await shipmentService.simulateMockEvent(created._id, 'out_for_delivery');
    await shipmentService.simulateMockEvent(created._id, 'delivered');
    assert.equal((await Product.findById(product._id)).variants[0].stock, beforeStock);
    assert.equal(await InventoryMovement.countDocuments({ product: product._id }), 0);
    const after = await Order.findById(fixture.order._id);
    assert.equal(after.paymentStatus, beforePayments);
    assert.equal(after.grandTotal, 2999);
  } finally {
    await Product.deleteOne({ _id: product._id });
    await cleanupOrder(fixture);
  }
});

test('24: non-mock provider path is untouched (shiprocket without creds → 503)', async () => {
  const fixture = await makeOrder('c24');
  shippingConfig.provider = 'shiprocket';
  try {
    await assert.rejects(() => shipmentService.createForOrder(fixture.order._id), (error) => error.statusCode === 503);
  } finally {
    shippingConfig.provider = 'mock';
    await cleanupOrder(fixture);
  }
});
