import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { inventoryService } from '../src/modules/inventory/service.js';

test.before(async () => {
  await connectDatabase();
  await Product.collection.dropIndex('product_code_1').catch(() => {});
});

test.after(async () => {
  await closeDatabase();
});

const createTestProductWithStock = async (stockCount, skuPrefix = 'TEST-SKU') => {
  const uniqueId = new mongoose.Types.ObjectId();
  const sku = `${skuPrefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const product = await Product.create({
    _id: uniqueId,
    name: `Test Sneaker ${Date.now()}-${Math.random().toString(36).substring(7)}`,
    slug: `test-sneaker-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    product_code: sku,
    price: 100,
    status: 'PUBLISHED',
    variants: [
      {
        _id: new mongoose.Types.ObjectId(),
        sku,
        size: 'US 10',
        color: 'Red',
        price: 100,
        stock: stockCount,
      },
    ],
  });

  const variantId = product.variants[0]._id;
  return { productId: product._id, variantId };
};

const cleanupProduct = async (productId, variantId) => {
  await Product.deleteOne({ _id: productId });
  await Inventory.deleteOne({ product: productId, variant: variantId });
  await InventoryMovement.deleteMany({ product: productId, variant: variantId });
};

test('Requirement 3: Concurrent Purchase Test (Initial stock = 1, 50 concurrent requests)', { concurrency: false }, async () => {
  const { productId, variantId } = await createTestProductWithStock(1, 'CONC-PURCH');

  const concurrentRequests = 50;
  const promises = [];

  for (let i = 0; i < concurrentRequests; i += 1) {
    promises.push(
      inventoryService.reserveStock(productId, variantId, 1, { referenceId: `ref-purch-${i}` })
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, statusCode: err.statusCode, message: err.message })),
    );
  }

  const results = await Promise.all(promises);

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 1, 'Exactly ONE operation must succeed');
  assert.equal(failures.length, concurrentRequests - 1, 'All other operations must fail');
  assert.ok(failures.every((f) => f.statusCode === 409), 'Failures must return HTTP 409');

  const invDoc = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invDoc.availableStock, 0, 'Final availableStock must be 0');
  assert.equal(invDoc.reservedStock, 1, 'Final reservedStock must be 1');
  assert.equal(invDoc.soldStock, 0, 'Final soldStock must be 0');
  assert.ok(invDoc.availableStock >= 0, 'availableStock must not be negative');
  assert.ok(invDoc.reservedStock >= 0, 'reservedStock must not be negative');

  const updatedProduct = await Product.findById(productId);
  assert.equal(updatedProduct.variants[0].stock, 0, 'Product variant stock must sync to 0');

  const movements = await InventoryMovement.find({ product: productId, variant: variantId });
  assert.equal(movements.length, 1, 'Only 1 movement record must be created for successful reservation');

  await cleanupProduct(productId, variantId);
});

test('Requirement 4: Multi-Quantity Concurrency Test (Initial stock = 5, 10 concurrent requests of qty 1)', { concurrency: false }, async () => {
  const { productId, variantId } = await createTestProductWithStock(5, 'MULTI-QTY');

  const concurrentRequests = 10;
  const promises = [];

  for (let i = 0; i < concurrentRequests; i += 1) {
    promises.push(
      inventoryService.reserveStock(productId, variantId, 1, { referenceId: `ref-multi-${i}` })
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, statusCode: err.statusCode, message: err.message })),
    );
  }

  const results = await Promise.all(promises);

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 5, 'Maximum 5 reservations must succeed');
  assert.equal(failures.length, 5, 'Minimum 5 reservations must fail');

  const invDoc = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invDoc.availableStock, 0, 'Final availableStock must be 0');
  assert.equal(invDoc.reservedStock, 5, 'Final reservedStock must be 5');

  const updatedProduct = await Product.findById(productId);
  assert.equal(updatedProduct.variants[0].stock, 0, 'Product variant stock must sync to 0');

  await cleanupProduct(productId, variantId);
});

test('Requirement 5: Release Concurrency Test (Reserved = 5, 10 concurrent release requests of qty 1)', { concurrency: false }, async () => {
  const { productId, variantId } = await createTestProductWithStock(5, 'RELEASE-CONC');

  // Reserve 5 units first
  await inventoryService.reserveStock(productId, variantId, 5, { referenceId: 'init-reserve-5' });

  const invBefore = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invBefore.reservedStock, 5, 'Reserved stock should be 5 before release');

  // Attempt 10 concurrent releases of 1 unit each
  const concurrentRequests = 10;
  const promises = [];

  for (let i = 0; i < concurrentRequests; i += 1) {
    promises.push(
      inventoryService.releaseStock(productId, variantId, 1, { referenceId: `ref-rel-${i}` })
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, statusCode: err.statusCode, message: err.message })),
    );
  }

  const results = await Promise.all(promises);

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 5, 'Exactly 5 releases must succeed');
  assert.equal(failures.length, 5, 'Remaining 5 releases must fail');

  const invAfter = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invAfter.reservedStock, 0, 'reservedStock must be 0, never negative');
  assert.equal(invAfter.availableStock, 5, 'availableStock must be restored to 5');

  const updatedProduct = await Product.findById(productId);
  assert.equal(updatedProduct.variants[0].stock, 5, 'Product variant stock must sync to 5');

  await cleanupProduct(productId, variantId);
});

test('Requirement 6: Commit/Sale Concurrency & Idempotency Test', { concurrency: false }, async () => {
  const { productId, variantId } = await createTestProductWithStock(5, 'COMMIT-SALE');

  // Reserve 5 units
  await inventoryService.reserveStock(productId, variantId, 5, { referenceId: 'res-for-commit' });

  // 10 concurrent commit calls of qty 1
  const concurrentRequests = 10;
  const promises = [];

  for (let i = 0; i < concurrentRequests; i += 1) {
    const ref = `ref-commit-${i}`;
    promises.push(
      inventoryService.commitSale(productId, variantId, 1, { referenceId: ref })
        .then(() => ({ success: true, ref }))
        .catch((err) => ({ success: false, statusCode: err.statusCode, ref })),
    );
  }

  const results = await Promise.all(promises);
  const successes = results.filter((r) => r.success);
  assert.equal(successes.length, 5, 'Exactly 5 commits must succeed');

  const invDoc = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invDoc.reservedStock, 0, 'reservedStock must be 0');
  assert.equal(invDoc.soldStock, 5, 'soldStock must be 5');

  // Test Idempotency: Retrying commitSale with an already processed referenceId that succeeded
  const successfulRef = successes[0].ref;
  const dupResult = await inventoryService.commitSale(productId, variantId, 1, { referenceId: successfulRef });
  assert.ok(dupResult, 'Idempotent call returns inventory document');

  const invDocAfterDup = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invDocAfterDup.soldStock, 5, 'soldStock must NOT be double-counted');
  assert.equal(invDocAfterDup.reservedStock, 0, 'reservedStock must NOT be decremented again');

  await cleanupProduct(productId, variantId);
});

test('Requirement 7: Restore/Refund Inventory Test (Sold = 2, concurrent restores total > 2)', { concurrency: false }, async () => {
  const { productId, variantId } = await createTestProductWithStock(5, 'REFUND-CONC');

  // Reserve 2 units then Commit 2 units -> soldStock = 2
  await inventoryService.reserveStock(productId, variantId, 2, { referenceId: 'res-for-refund' });
  await inventoryService.commitSale(productId, variantId, 2, { referenceId: 'sale-for-refund' });

  const invInitial = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invInitial.soldStock, 2, 'soldStock must be 2');
  assert.equal(invInitial.availableStock, 3, 'availableStock must be 3');

  // Two separate refund attempts of 2 units each concurrently
  const promises = [
    inventoryService.restoreStock(productId, variantId, 2, { referenceId: 'refund-1' }),
    inventoryService.restoreStock(productId, variantId, 2, { referenceId: 'refund-2' }),
  ].map((p) => p.then(() => ({ success: true })).catch((err) => ({ success: false, statusCode: err.statusCode })));

  const results = await Promise.all(promises);

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 1, 'Only ONE refund of 2 units can succeed');
  assert.equal(failures.length, 1, 'Second refund of 2 units must fail');

  const invFinal = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invFinal.soldStock, 0, 'soldStock must be 0, never negative');
  assert.equal(invFinal.availableStock, 5, 'availableStock must be 5 (3 + 2 restored)');

  await cleanupProduct(productId, variantId);
});

test('Negative Stock Adjustment Concurrency Test (Stock = 3, 2 concurrent adjustments of -3)', { concurrency: false }, async () => {
  const { productId, variantId } = await createTestProductWithStock(3, 'ADJUST-NEG');

  const promises = [
    inventoryService.adjustStock(productId, variantId, -3, { referenceId: 'adj-1' }),
    inventoryService.adjustStock(productId, variantId, -3, { referenceId: 'adj-2' }),
  ].map((p) => p.then(() => ({ success: true })).catch((err) => ({ success: false, statusCode: err.statusCode })));

  const results = await Promise.all(promises);

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 1, 'Only one -3 adjustment can succeed');
  assert.equal(failures.length, 1, 'Second adjustment must fail with 409');

  const invDoc = await Inventory.findOne({ product: productId, variant: variantId });
  assert.equal(invDoc.availableStock, 0, 'availableStock must be 0, never negative');

  await cleanupProduct(productId, variantId);
});
