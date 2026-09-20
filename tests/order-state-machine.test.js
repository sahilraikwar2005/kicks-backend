import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Order from '../src/modules/orders/model.js';
import { orderService } from '../src/modules/orders/service.js';

const makeOrder = async ({ status = 'PENDING', paymentStatus = 'PENDING' } = {}) => {
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(),
    orderNumber: `ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    items: [{
      productId: new mongoose.Types.ObjectId(),
      variantId: new mongoose.Types.ObjectId(),
      productName: 'Order State Shoe',
      sku: 'ORDER-STATE-SKU',
      size: 'US 9',
      color: 'Black',
      quantity: 1,
      unitPrice: 200,
      finalPrice: 200,
    }],
    shippingAddress: { addressLine1: '123 Main', city: 'Mumbai', country: 'India' },
    customerSnapshot: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
    subtotal: 200,
    grandTotal: 200,
    status,
    paymentStatus,
  });
  return order;
};

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await Order.deleteMany({});
  await closeDatabase();
});

test('order state machine: valid transitions allow the current business flow', async () => {
  const pending = await makeOrder();
  const confirmed = await orderService.updateStatus(pending._id, 'CONFIRMED');
  assert.equal(confirmed.status, 'CONFIRMED');

  const processing = await orderService.updateStatus(confirmed._id, 'PROCESSING');
  assert.equal(processing.status, 'PROCESSING');

  const packed = await orderService.updateStatus(processing._id, 'PACKED');
  assert.equal(packed.status, 'PACKED');

  const shipped = await orderService.updateStatus(packed._id, 'SHIPPED');
  assert.equal(shipped.status, 'SHIPPED');

  const outForDelivery = await orderService.updateStatus(shipped._id, 'OUT_FOR_DELIVERY');
  assert.equal(outForDelivery.status, 'OUT_FOR_DELIVERY');

  const delivered = await orderService.updateStatus(outForDelivery._id, 'DELIVERED');
  assert.equal(delivered.status, 'DELIVERED');
});

test('order state machine: invalid transitions reject with 409 conflict', async () => {
  const delivered = await makeOrder({ status: 'DELIVERED', paymentStatus: 'PAID' });
  await assert.rejects(() => orderService.updateStatus(delivered._id, 'PENDING'), /Invalid order transition|409/i);
  await assert.rejects(() => orderService.updateStatus(delivered._id, 'SHIPPED'), /Invalid order transition|409/i);

  const cancelled = await makeOrder({ status: 'CANCELLED' });
  await assert.rejects(() => orderService.updateStatus(cancelled._id, 'PROCESSING'), /Invalid order transition|409/i);

  const refunded = await makeOrder({ status: 'REFUNDED', paymentStatus: 'REFUNDED' });
  await assert.rejects(() => orderService.updateStatus(refunded._id, 'SHIPPED'), /Invalid order transition|409/i);
});

test('order state machine: customer cancellation is restricted to eligible states', async () => {
  const pending = await makeOrder({ status: 'PENDING', paymentStatus: 'PENDING' });
  const cancelled = await orderService.cancelByCustomer(pending.user, pending._id);
  assert.equal(cancelled.status, 'CANCELLED');

  const paidPending = await makeOrder({ status: 'PENDING', paymentStatus: 'PAID' });
  await assert.rejects(() => orderService.cancelByCustomer(paidPending.user, paidPending._id), /Only unpaid pending orders/i);

  const shipped = await makeOrder({ status: 'SHIPPED', paymentStatus: 'PAID' });
  await assert.rejects(() => orderService.cancelByCustomer(shipped.user, shipped._id), /Only unpaid pending orders/i);
});

test('order state machine: paid orders cannot be cancelled by a status update', async () => {
  const paidOrder = await makeOrder({ status: 'PENDING', paymentStatus: 'PAID' });
  await assert.rejects(() => orderService.updateStatus(paidOrder._id, 'CANCELLED'), /Paid orders cannot be cancelled/i);
});

test('order state machine: concurrent status updates are serialized by the transition guard', async () => {
  const order = await makeOrder({ status: 'CONFIRMED', paymentStatus: 'PAID' });
  const results = await Promise.allSettled([
    orderService.updateStatus(order._id, 'PROCESSING'),
    orderService.updateStatus(order._id, 'PROCESSING'),
  ]);

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  assert.equal(fulfilled.length, 1);
  assert.equal(fulfilled[0].value.status, 'PROCESSING');
});
