import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { inventoryService } from '../src/modules/inventory/service.js';

// Bulk stock-adjustment coverage. Probe products use unique names and are
// removed in finally blocks — shared development data is never touched.
test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

const createBulkProduct = async (stock = 6) => {
  const suffix = uniqueSuffix();
  const product = await Product.create({
    name: `Bulk Adjust Test ${suffix}`,
    slug: `bulk-adjust-test-${suffix}`,
    price: 4999,
    status: 'PUBLISHED',
    variants: [
      { sku: `BULK-UK7-${suffix}`.toUpperCase(), size: 'UK 7', color: 'Black', price: 4999, stock },
    ],
  });
  return { productId: product._id, variantId: product.variants[0]._id };
};

const cleanupBulkProduct = async (productId) => {
  await Product.deleteOne({ _id: productId });
  await Inventory.deleteMany({ product: productId });
  await InventoryMovement.deleteMany({ product: productId });
};

const variantStock = async (productId) => {
  const refreshed = await Product.findById(productId).lean();
  return refreshed.variants[0].stock;
};

test('bulk restock +10: 6 → 16 in one atomic operation', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    const item = await inventoryService.adjustStock(productId, variantId, 10, { reason: 'Restock' });
    assert.equal(item.availableStock, 16);
    assert.equal(await variantStock(productId), 16);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('bulk restock +25', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    const item = await inventoryService.adjustStock(productId, variantId, 25, { reason: 'Supplier delivery' });
    assert.equal(item.availableStock, 31);
    assert.equal(await variantStock(productId), 31);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('bulk remove 2: 6 → 4', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    const item = await inventoryService.adjustStock(productId, variantId, -2, { reason: 'Stock correction' });
    assert.equal(item.availableStock, 4);
    assert.equal(await variantStock(productId), 4);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('bulk remove exactly the current stock: 6 → 0', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    const item = await inventoryService.adjustStock(productId, variantId, -6, { reason: 'Stock correction' });
    assert.equal(item.availableStock, 0);
    assert.equal(await variantStock(productId), 0);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('bulk remove more than available is rejected and stock is unchanged', async () => {
  const { productId, variantId } = await createBulkProduct(2);
  try {
    await assert.rejects(
      () => inventoryService.adjustStock(productId, variantId, -5, { reason: 'Stock correction' }),
      (error) => error.statusCode === 409 && /cannot remove more stock/i.test(error.message),
    );
    const item = await Inventory.findOne({ product: productId, variant: variantId });
    // ensureInventory seeds on the failed touch, but the guarded $inc never applies.
    assert.ok(!item || item.availableStock === 2);
    assert.equal(await variantStock(productId), 2);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('bulk adjustment rejects zero, decimal, non-numeric and excessive quantities', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    await assert.rejects(() => inventoryService.adjustStock(productId, variantId, 0, {}), (error) => error.statusCode === 400);
    await assert.rejects(() => inventoryService.adjustStock(productId, variantId, 2.5, {}), (error) => error.statusCode === 400 && /whole number/i.test(error.message));
    await assert.rejects(() => inventoryService.adjustStock(productId, variantId, 'abc', {}), (error) => error.statusCode === 400);
    await assert.rejects(() => inventoryService.adjustStock(productId, variantId, 10001, {}), (error) => error.statusCode === 400 && /exceed/i.test(error.message));
    await assert.rejects(() => inventoryService.adjustStock(productId, variantId, -10001, {}), (error) => error.statusCode === 400);
    assert.equal(await variantStock(productId), 6);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('one bulk adjustment creates exactly one movement record with the reason', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    await inventoryService.adjustStock(productId, variantId, 10, { reason: 'New stock received' });
    const movements = await InventoryMovement.find({ product: productId, variant: variantId }).lean();
    assert.equal(movements.length, 1);
    assert.equal(movements[0].type, 'ADJUSTMENT');
    assert.equal(movements[0].quantity, 10);
    assert.equal(movements[0].reason, 'New stock received');
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('simultaneous bulk adjustments stay atomic: 6 +10 +5 → 21', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    const [first, second] = await Promise.all([
      inventoryService.adjustStock(productId, variantId, 10, { reason: 'Restock' }),
      inventoryService.adjustStock(productId, variantId, 5, { reason: 'Restock' }),
    ]);
    assert.ok(first.availableStock > 6 && second.availableStock > 6);
    const item = await Inventory.findOne({ product: productId, variant: variantId });
    assert.equal(item.availableStock, 21);
    assert.equal(await variantStock(productId), 21);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('simultaneous over-removals: only one -5 of two succeeds from stock 6', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    const outcomes = await Promise.allSettled([
      inventoryService.adjustStock(productId, variantId, -5, { reason: 'Stock correction' }),
      inventoryService.adjustStock(productId, variantId, -5, { reason: 'Stock correction' }),
    ]);
    const successes = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].reason.statusCode, 409);
    assert.equal(await variantStock(productId), 1);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('single-unit +/- controls still work after bulk hardening', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    assert.equal((await inventoryService.adjustStock(productId, variantId, 1, { reason: 'Restock' })).availableStock, 7);
    assert.equal((await inventoryService.adjustStock(productId, variantId, -1, { reason: 'Offline sale' })).availableStock, 6);
    assert.equal(await variantStock(productId), 6);
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('offline SELL flow is unchanged by bulk hardening', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    const item = await inventoryService.adjustStock(productId, variantId, -1, { reason: 'Offline sale' });
    assert.equal(item.availableStock, 5);
    const movement = await InventoryMovement.findOne({ product: productId, variant: variantId }).lean();
    assert.equal(movement.type, 'ADJUSTMENT');
    assert.equal(movement.reason, 'Offline sale');
  } finally {
    await cleanupBulkProduct(productId);
  }
});

test('low-stock visibility follows bulk adjustments', async () => {
  const { productId, variantId } = await createBulkProduct(6);
  try {
    await inventoryService.adjustStock(productId, variantId, 10, { reason: 'Restock' });
    const forProduct = (list) => list.filter((item) => String(item.product?._id || item.product) === String(productId));
    assert.equal(forProduct(await inventoryService.getLowStock()).length, 0);
    await inventoryService.adjustStock(productId, variantId, -12, { reason: 'Stock correction' });
    assert.equal(forProduct(await inventoryService.getLowStock()).length, 1);
  } finally {
    await cleanupBulkProduct(productId);
  }
});
