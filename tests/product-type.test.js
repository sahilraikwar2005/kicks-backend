import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import { productService } from '../src/modules/products/service.js';
import { createProductSchema } from '../src/modules/products/validation.js';

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test('product type passes create validation and rejects unknown types', () => {
  const ok = createProductSchema.validate(
    { name: 'Type Probe', price: 999, type: 'TSHIRT', variants: [] },
    { abortEarly: false, stripUnknown: true },
  );
  assert.equal(ok.error, undefined);
  assert.equal(ok.value.type, 'TSHIRT');

  const bad = createProductSchema.validate(
    { name: 'Type Probe', price: 999, type: 'SPACESHIP' },
    { abortEarly: false, stripUnknown: true },
  );
  assert.ok(bad.error);
});

test('product type defaults to SHOES and survives update', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `Type Default ${suffix}`,
    slug: `type-default-${suffix}`,
    price: 1999,
    status: 'DRAFT',
    images: [],
    variants: [{ size: 'UK 8', color: 'Black', price: 1999, stock: 2, sku: '' }],
  });
  try {
    assert.equal(created.type, 'SHOES');
    const updated = await productService.updateProduct(created._id, { type: 'SOCKS' });
    assert.equal(updated.type, 'SOCKS');
  } finally {
    await Product.deleteOne({ _id: created._id });
  }
});

test('single-color multi-size product keeps independent stock per size', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `Single Color ${suffix}`,
    slug: `single-color-${suffix}`,
    price: 3999,
    status: 'DRAFT',
    type: 'SHOES',
    images: [],
    variants: [
      { size: 'UK 6', color: 'White', price: 3999, stock: 3, sku: '' },
      { size: 'UK 7', color: 'White', price: 3999, stock: 1, sku: '' },
      { size: 'UK 8', color: 'White', price: 3999, stock: 0, sku: '' },
    ],
  });
  try {
    assert.equal(created.variants.length, 3);
    const colors = new Set(created.variants.map((variant) => variant.color));
    assert.deepEqual([...colors], ['White']);
    const bySize = Object.fromEntries(created.variants.map((variant) => [variant.size, variant.stock]));
    assert.deepEqual(bySize, { 'UK 6': 3, 'UK 7': 1, 'UK 8': 0 });
    for (const variant of created.variants) {
      assert.ok(variant.sku && variant.sku.length > 0);
    }
  } finally {
    await Product.deleteOne({ _id: created._id });
  }
});

test('legacy product without type remains readable and editable', async () => {
  const suffix = uniqueSuffix();
  const legacy = await Product.create({
    name: `Legacy No Type ${suffix}`,
    slug: `legacy-no-type-${suffix}`,
    price: 999,
    variants: [{ sku: `LEGACY-${suffix}`.toUpperCase(), size: 'UK 9', color: 'Red', price: 999, stock: 1, images: [] }],
  });
  try {
    assert.equal(legacy.type, 'SHOES');
    const updated = await productService.updateProduct(legacy._id, { price: 1099 });
    assert.equal(updated.price, 1099);
  } finally {
    await Product.deleteOne({ _id: legacy._id });
  }
});
