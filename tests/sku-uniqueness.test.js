import test from 'node:test';
import assert from 'node:assert/strict';

import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import { productService } from '../src/modules/products/service.js';

const makeProductPayload = (index = 1, skuPrefix = 'SKU') => ({
  name: `SKU Product ${index}`,
  slug: `sku-product-${index}-${Date.now()}`,
  price: 200,
  status: 'PUBLISHED',
  variants: [{
    sku: `${skuPrefix}-${index}-${Date.now()}`,
    size: 'US 9',
    color: 'Black',
    price: 200,
    stock: 10,
  }],
});

const cleanup = async () => {
  await Product.deleteMany({});
};

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await cleanup();
  await closeDatabase();
});

test('sku uniqueness: duplicate SKU within the same request is rejected', async () => {
  await assert.rejects(() => productService.createProduct({
    name: 'Duplicate Same Request',
    slug: `same-request-${Date.now()}`,
    price: 200,
    status: 'PUBLISHED',
    variants: [
      { sku: 'ANDY-1', size: 'US 8', color: 'Black', price: 200, stock: 10 },
      { sku: 'andy-1', size: 'US 9', color: 'White', price: 220, stock: 8 },
    ],
  }), /unique|already exists/i);
});

test('sku uniqueness: duplicate SKU across products is rejected', async () => {
  const first = await productService.createProduct(makeProductPayload(1, 'CROSS'));
  await assert.rejects(() => productService.createProduct({
    ...makeProductPayload(2, 'CROSS'),
    variants: [{ ...makeProductPayload(2, 'CROSS').variants[0], sku: first.variants[0].sku }],
  }), /already exists|unique/i);
  await Product.deleteOne({ _id: first._id });
});

test('sku uniqueness: duplicate SKU during update is rejected', async () => {
  const first = await productService.createProduct(makeProductPayload(3, 'UPDATE'));
  const second = await productService.createProduct(makeProductPayload(4, 'UPDATE-2'));
  await assert.rejects(() => productService.updateProduct(second._id, {
    variants: [{ ...second.variants[0], sku: first.variants[0].sku }],
  }), /already exists|unique/i);
  await Product.deleteMany({ _id: { $in: [first._id, second._id] } });
});

test('sku uniqueness: normalized duplicate values are treated as one SKU', async () => {
  await assert.rejects(() => productService.createProduct({
    name: 'Normalized Duplicate',
    slug: `normalized-duplicate-${Date.now()}`,
    price: 150,
    status: 'PUBLISHED',
    variants: [
      { sku: 'NORM-001', size: 'US 8', color: 'Black', price: 150, stock: 5 },
      { sku: 'norm-001', size: 'US 9', color: 'White', price: 170, stock: 3 },
    ],
  }), /unique|already exists/i);
});

test('sku uniqueness: concurrent creation cannot claim the same SKU twice', async () => {
  const payload = {
    name: 'Concurrent SKU',
    slug: `concurrent-sku-${Date.now()}`,
    price: 300,
    status: 'PUBLISHED',
    variants: [{ sku: 'CONCURRENT-777', size: 'US 10', color: 'Black', price: 300, stock: 2 }],
  };

  const results = await Promise.allSettled([
    productService.createProduct(payload),
    productService.createProduct({ ...payload, slug: `concurrent-sku-${Date.now()}-2` }),
  ]);

  const successes = results.filter((result) => result.status === 'fulfilled');
  assert.equal(successes.length, 1);
  const created = successes[0].value;
  await Product.deleteOne({ _id: created._id });
});

test('sku uniqueness: archived products still reserve the SKU', async () => {
  const archived = await productService.createProduct({
    name: 'Archived SKU Product',
    slug: `archived-sku-${Date.now()}`,
    price: 150,
    status: 'ARCHIVED',
    variants: [{ sku: 'ARCH-100', size: 'US 7', color: 'Black', price: 150, stock: 0 }],
  });

  await assert.rejects(() => productService.createProduct({
    name: 'Archived Conflict',
    slug: `archived-conflict-${Date.now()}`,
    price: 180,
    status: 'PUBLISHED',
    variants: [{ sku: archived.variants[0].sku, size: 'US 8', color: 'Red', price: 180, stock: 3 }],
  }), /already exists|unique/i);
  await Product.deleteOne({ _id: archived._id });
});

test('sku uniqueness: valid unique SKUs continue to work', async () => {
  const product = await productService.createProduct({
    name: 'Unique SKU Product',
    slug: `unique-sku-${Date.now()}`,
    price: 210,
    status: 'PUBLISHED',
    variants: [{ sku: 'UNIQUE-123', size: 'US 8', color: 'Blue', price: 210, stock: 5 }],
  });

  assert.equal(product.variants[0].sku, 'UNIQUE-123');
  await Product.deleteOne({ _id: product._id });
});
