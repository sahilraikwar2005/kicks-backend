import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import app from '../src/app.js';
import Product from '../src/modules/products/model.js';
import { productService } from '../src/modules/products/service.js';
import { createProductSchema } from '../src/modules/products/validation.js';

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const apiBase = `http://127.0.0.1:${server.address().port}/api/v1`;

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const cloudImage = (name) => `https://res.cloudinary.com/demo/image/upload/kicks/products/${name}.jpg`;

const cleanupProduct = async (productId) => {
  await Product.deleteOne({ _id: productId });
};

test('product create validation preserves the full image payload', () => {
  const payload = {
    name: 'Image Schema Probe',
    price: 7499,
    images: [cloudImage('one'), cloudImage('two')],
    variants: [{ sku: '', size: 'UK 8', color: 'Black', price: 7499, stock: 2, images: [] }],
  };
  const { error, value } = createProductSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  assert.equal(error, undefined);
  assert.deepEqual(value.images, payload.images);
  assert.equal(value.variants.length, 1);
});

test('upload endpoint rejects unauthenticated product image uploads', async () => {
  const form = new FormData();
  form.append('image', new Blob(['fake'], { type: 'image/png' }), 'probe.png');
  const response = await fetch(`${apiBase}/uploads/images`, { method: 'POST', body: form });
  assert.equal(response.status, 401);
});

test('single uploaded image persists and is returned by product APIs', async () => {
  const suffix = uniqueSuffix();
  const url = cloudImage(`single-${suffix}`);
  const created = await productService.createProduct({
    name: `Single Image ${suffix}`,
    slug: `single-image-${suffix}`,
    price: 7499,
    status: 'PUBLISHED',
    images: [url],
    variants: [{ size: 'UK 8', color: 'Black', price: 7499, stock: 4, sku: '' }],
  });
  try {
    assert.deepEqual(created.images, [url]);

    const stored = await Product.findById(created._id).lean();
    assert.deepEqual(stored.images, [url]);

    const listed = await productService.listProducts({ search: `Single Image ${suffix}` });
    const listedItem = listed.items.find((item) => String(item._id) === String(created._id));
    assert.ok(listedItem);
    assert.deepEqual(listedItem.images.map(String), [url]);

    const bySlug = await productService.getProductBySlug(`single-image-${suffix}`);
    assert.deepEqual(bySlug.images.map(String), [url]);
  } finally {
    await cleanupProduct(created._id);
  }
});

test('multiple uploaded images persist in order for cards and gallery', async () => {
  const suffix = uniqueSuffix();
  const urls = [cloudImage(`a-${suffix}`), cloudImage(`b-${suffix}`), cloudImage(`c-${suffix}`)];
  const created = await productService.createProduct({
    name: `Multi Image ${suffix}`,
    slug: `multi-image-${suffix}`,
    price: 7999,
    status: 'PUBLISHED',
    images: urls,
    variants: [{ size: 'UK 9', color: 'White', price: 7999, stock: 3, sku: '' }],
  });
  try {
    assert.deepEqual(created.images, urls);
    const stored = await Product.findById(created._id).lean();
    assert.deepEqual(stored.images, urls);
    assert.equal(stored.images[0], urls[0]);
  } finally {
    await cleanupProduct(created._id);
  }
});

test('product update adds, removes and reorders images', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `Edit Image ${suffix}`,
    slug: `edit-image-${suffix}`,
    price: 6999,
    status: 'DRAFT',
    images: [cloudImage(`old-${suffix}`)],
    variants: [{ size: 'UK 7', color: 'Black', price: 6999, stock: 2, sku: '' }],
  });
  try {
    const first = cloudImage(`new1-${suffix}`);
    const second = cloudImage(`new2-${suffix}`);
    const updated = await productService.updateProduct(created._id, { images: [first, second] });
    assert.deepEqual(updated.images.map(String), [first, second]);

    const reordered = await productService.updateProduct(created._id, { images: [second, first] });
    assert.deepEqual(reordered.images.map(String), [second, first]);

    const cleared = await productService.updateProduct(created._id, { images: [] });
    assert.deepEqual(cleared.images, []);
  } finally {
    await cleanupProduct(created._id);
  }
});

test('products without images store an empty array, never a demo URL', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `No Image ${suffix}`,
    slug: `no-image-${suffix}`,
    price: 4999,
    status: 'DRAFT',
    images: [],
    variants: [{ size: 'UK 8', color: 'Black', price: 4999, stock: 1, sku: '' }],
  });
  try {
    assert.deepEqual(created.images, []);
    const stored = await Product.findById(created._id).lean();
    assert.ok(Array.isArray(stored.images));
    assert.ok(stored.images.every((url) => !String(url).includes('unsplash')));
  } finally {
    await cleanupProduct(created._id);
  }
});
