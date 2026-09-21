import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { inventoryService } from '../src/modules/inventory/service.js';

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

const createOfflineSaleProduct = async () => {
  const suffix = uniqueSuffix();
  const product = await Product.create({
    name: `Offline Sale Test ${suffix}`,
    slug: `offline-sale-test-${suffix}`,
    price: 7499,
    status: 'PUBLISHED',
    variants: [
      { sku: `OFFLINE-UK8-${suffix}`.toUpperCase(), size: 'UK 8', color: 'Black', price: 7499, stock: 6 },
      { sku: `OFFLINE-UK9-${suffix}`.toUpperCase(), size: 'UK 9', color: 'Black', price: 7599, stock: 3 },
    ],
  });
  return {
    productId: product._id,
    uk8: product.variants.find((variant) => variant.size === 'UK 8')._id,
    uk9: product.variants.find((variant) => variant.size === 'UK 9')._id,
  };
};

const cleanupOfflineSaleProduct = async (productId) => {
  await Product.deleteOne({ _id: productId });
  await Inventory.deleteMany({ product: productId });
  await InventoryMovement.deleteMany({ product: productId });
};

test('offline sale: first touch on a fresh Add-Product variant seeds and decrements only that variant', async () => {
  const { productId, uk8 } = await createOfflineSaleProduct();
  try {
    assert.equal(await Inventory.countDocuments({ product: productId }), 0);

    const item = await inventoryService.adjustStock(productId, uk8, -1, { reason: 'Offline sale' });

    assert.equal(item.variant.toString(), uk8.toString());
    assert.equal(item.availableStock, 5);

    const refreshed = await Product.findById(productId).lean();
    const stocks = Object.fromEntries(refreshed.variants.map((variant) => [variant.size, variant.stock]));
    assert.equal(stocks['UK 8'], 5);
    assert.equal(stocks['UK 9'], 3);

    const movement = await InventoryMovement.findOne({ product: productId, variant: uk8 }).lean();
    assert.equal(movement.type, 'ADJUSTMENT');
    assert.equal(movement.quantity, 1);
    assert.equal(movement.reason, 'Offline sale');
  } finally {
    await cleanupOfflineSaleProduct(productId);
  }
});

test('offline sale: selling more than available stock fails without going negative', async () => {
  const { productId, uk8 } = await createOfflineSaleProduct();
  try {
    await assert.rejects(
      () => inventoryService.adjustStock(productId, uk8, -7, { reason: 'Offline sale' }),
      (error) => error.statusCode === 409,
    );

    const refreshed = await Product.findById(productId).lean();
    assert.equal(refreshed.variants.find((variant) => variant.size === 'UK 8').stock, 6);
  } finally {
    await cleanupOfflineSaleProduct(productId);
  }
});

test('offline restock: positive adjustment increases only the target variant', async () => {
  const { productId, uk9 } = await createOfflineSaleProduct();
  try {
    const item = await inventoryService.adjustStock(productId, uk9, 4, { reason: 'Restock' });
    assert.equal(item.availableStock, 7);

    const refreshed = await Product.findById(productId).lean();
    const stocks = Object.fromEntries(refreshed.variants.map((variant) => [variant.size, variant.stock]));
    assert.equal(stocks['UK 9'], 7);
    assert.equal(stocks['UK 8'], 6);
  } finally {
    await cleanupOfflineSaleProduct(productId);
  }
});

test('offline sale: zeroing one size leaves sibling sizes untouched', async () => {
  const { productId, uk8 } = await createOfflineSaleProduct();
  try {
    await inventoryService.adjustStock(productId, uk8, -6, { reason: 'Offline sale' });

    const refreshed = await Product.findById(productId).lean();
    const stocks = Object.fromEntries(refreshed.variants.map((variant) => [variant.size, variant.stock]));
    assert.equal(stocks['UK 8'], 0);
    assert.equal(stocks['UK 9'], 3);
  } finally {
    await cleanupOfflineSaleProduct(productId);
  }
});

test('variant resolution: unknown variant ids resolve to no product', async () => {
  assert.equal(await inventoryService.resolveProductForVariant(new mongoose.Types.ObjectId()), null);
  assert.equal(await inventoryService.resolveProductForVariant('not-an-id'), null);
});

test('variant resolution: existing variant resolves to its owning product', async () => {
  const { productId, uk8 } = await createOfflineSaleProduct();
  try {
    const owner = await inventoryService.resolveProductForVariant(uk8);
    assert.equal(String(owner), String(productId));
  } finally {
    await cleanupOfflineSaleProduct(productId);
  }
});
