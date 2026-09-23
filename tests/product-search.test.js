import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import { productService } from '../src/modules/products/service.js';

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test('product search matches color, SKU and slug for inventory lookup', async () => {
  const suffix = uniqueSuffix();
  const sku = `SEARCH-${suffix}`.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const created = await productService.createProduct({
    name: `Search Lookup ${suffix}`,
    slug: `search-lookup-${suffix}`,
    price: 2999,
    status: 'PUBLISHED',
    type: 'SHOES',
    images: [],
    variants: [{ size: 'UK 9', color: 'Teal', price: 2999, stock: 2, sku }],
  });
  try {
    const byColor = await productService.listProducts({ search: 'teal', limit: 50 });
    assert.ok(byColor.items.some((item) => String(item._id) === String(created._id)), 'color search finds product');

    const bySku = await productService.listProducts({ search: sku.slice(0, 12), limit: 50 });
    assert.ok(bySku.items.some((item) => String(item._id) === String(created._id)), 'SKU search finds product');

    const bySlug = await productService.listProducts({ search: `search-lookup-${suffix}`, limit: 50 });
    assert.ok(bySlug.items.some((item) => String(item._id) === String(created._id)), 'slug search finds product');
  } finally {
    await Product.deleteOne({ _id: created._id });
  }
});
