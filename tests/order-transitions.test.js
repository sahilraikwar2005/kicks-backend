import test from 'node:test';
import assert from 'node:assert/strict';
import { assertValidOrderTransition } from '../src/modules/orders/service.js';

// Pure state-machine contract tests: no database, no network. These lock the
// backend protection the admin UI mirrors — the UI only offers the current
// status plus its legal successors, and everything past PACKED arrives
// exclusively through shipment/carrier events.

const rejects409 = (fn, pattern) => assert.rejects(
  (async () => fn())(),
  (error) => error.statusCode === 409 && (!pattern || pattern.test(error.message)),
);

test('PROCESSING → PACKED is allowed', () => {
  assertValidOrderTransition('PROCESSING', 'PACKED');
});

test('PROCESSING → SHIPPED is rejected', async () => {
  await rejects409(() => assertValidOrderTransition('PROCESSING', 'SHIPPED'), /PROCESSING to SHIPPED/);
});

test('PROCESSING → DELIVERED is rejected', async () => {
  await rejects409(() => assertValidOrderTransition('PROCESSING', 'DELIVERED'));
});

test('state machine still permits PACKED → SHIPPED (UI withholds it, carrier path owns it)', () => {
  assertValidOrderTransition('PACKED', 'SHIPPED');
});

test('early-lifecycle transitions are intact', () => {
  assertValidOrderTransition('PENDING', 'CONFIRMED');
  assertValidOrderTransition('PENDING', 'CANCELLED');
  assertValidOrderTransition('CONFIRMED', 'PROCESSING');
  assertValidOrderTransition('CONFIRMED', 'CANCELLED');
});

test('carrier-leg transitions are intact', () => {
  assertValidOrderTransition('SHIPPED', 'OUT_FOR_DELIVERY');
  assertValidOrderTransition('OUT_FOR_DELIVERY', 'DELIVERED');
});

test('terminal and unknown statuses reject everything', async () => {
  for (const from of ['DELIVERED', 'CANCELLED', 'REFUNDED', 'BOGUS']) {
    await rejects409(() => assertValidOrderTransition(from, 'SHIPPED'));
  }
  await rejects409(() => assertValidOrderTransition('PENDING', 'DELIVERED'));
  await rejects409(() => assertValidOrderTransition('CONFIRMED', 'SHIPPED'));
});
