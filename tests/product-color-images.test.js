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
const cloudImage = (name) => `https://res.cloudinary.com/demo/image/upload/kicks/products/${name}.jpg`;

const cleanupProduct = async (productId) => {
  await Product.deleteOne({ _id: productId });
};

test('color image validation accepts per-color galleries', () => {
  const { error, value } = createProductSchema.validate({
    name: 'Color Gallery Probe',
    price: 10000,
    colorImages: { Black: [cloudImage('b1'), cloudImage('b2')], White: [cloudImage('w1')] },
  }, { abortEarly: false, stripUnknown: true });
  assert.equal(error, undefined);
  assert.deepEqual(value.colorImages.Black, [cloudImage('b1'), cloudImage('b2')]);
});

test('17. color image data persists on create with one gallery per color', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `Color Gallery ${suffix}`,
    slug: `color-gallery-${suffix}`,
    price: 10000,
    status: 'DRAFT',
    images: [cloudImage(`general-${suffix}`)],
    colorImages: {
      Black: [cloudImage(`black-front-${suffix}`), cloudImage(`black-side-${suffix}`), cloudImage(`black-back-${suffix}`)],
      White: [cloudImage(`white-front-${suffix}`), cloudImage(`white-side-${suffix}`), cloudImage(`white-back-${suffix}`)],
    },
    variants: [
      { size: 'UK 5', color: 'Black', price: 10000, stock: 6, sku: '' },
      { size: 'UK 5', color: 'White', price: 11000, stock: 4, sku: '' },
    ],
  });
  try {
    const stored = await Product.findById(created._id).lean();
    const galleries = stored.colorImages instanceof Map
      ? Object.fromEntries(stored.colorImages)
      : stored.colorImages;
    assert.deepEqual(galleries.Black, [
      cloudImage(`black-front-${suffix}`),
      cloudImage(`black-side-${suffix}`),
      cloudImage(`black-back-${suffix}`),
    ]);
    assert.deepEqual(galleries.White, [
      cloudImage(`white-front-${suffix}`),
      cloudImage(`white-side-${suffix}`),
      cloudImage(`white-back-${suffix}`),
    ]);
    const bySlug = await productService.getProductBySlug(`color-gallery-${suffix}`);
    const apiGalleries = bySlug.colorImages instanceof Map ? Object.fromEntries(bySlug.colorImages) : bySlug.colorImages;
    assert.equal(apiGalleries.Black.length, 3);
    assert.equal(apiGalleries.White.length, 3);
  } finally {
    await cleanupProduct(created._id);
  }
});

test('18/25/26. color galleries persist through edit, removal and reorder', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `Color Edit ${suffix}`,
    slug: `color-edit-${suffix}`,
    price: 10000,
    status: 'DRAFT',
    images: [cloudImage(`general-${suffix}`)],
    colorImages: { Black: [cloudImage(`b1-${suffix}`), cloudImage(`b2-${suffix}`)] },
    variants: [{ size: 'UK 5', color: 'Black', price: 10000, stock: 6, sku: '' }],
  });
  try {
    const reordered = await productService.updateProduct(created._id, {
      colorImages: { Black: [cloudImage(`b2-${suffix}`), cloudImage(`b1-${suffix}`)] },
    });
    const reorderedGalleries = reordered.colorImages instanceof Map
      ? Object.fromEntries(reordered.colorImages)
      : reordered.colorImages;
    assert.deepEqual(reorderedGalleries.Black, [cloudImage(`b2-${suffix}`), cloudImage(`b1-${suffix}`)]);

    const removed = await productService.updateProduct(created._id, { colorImages: {} });
    const removedGalleries = removed.colorImages instanceof Map ? Object.fromEntries(removed.colorImages) : removed.colorImages;
    assert.deepEqual(removedGalleries || {}, {});
  } finally {
    await cleanupProduct(created._id);
  }
});

test('color image sanitizer drops empty and malformed entries', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `Color Sanitize ${suffix}`,
    slug: `color-sanitize-${suffix}`,
    price: 10000,
    status: 'DRAFT',
    colorImages: { Black: [cloudImage(`ok-${suffix}`), '', null, 42], '   ': [cloudImage(`x-${suffix}`)] },
    variants: [{ size: 'UK 5', color: 'Black', price: 10000, stock: 1, sku: '' }],
  });
  try {
    const galleries = created.colorImages instanceof Map ? Object.fromEntries(created.colorImages) : created.colorImages;
    assert.deepEqual(galleries.Black, [cloudImage(`ok-${suffix}`)]);
    assert.ok(!('' in galleries) && !('   ' in galleries));
  } finally {
    await cleanupProduct(created._id);
  }
});

test('28. products without color galleries keep working with general images', async () => {
  const suffix = uniqueSuffix();
  const created = await productService.createProduct({
    name: `Legacy Gallery ${suffix}`,
    slug: `legacy-gallery-${suffix}`,
    price: 9000,
    status: 'PUBLISHED',
    images: [cloudImage(`legacy-${suffix}`)],
    variants: [{ size: 'UK 8', color: 'Black', price: 9000, stock: 3, sku: '' }],
  });
  try {
    const bySlug = await productService.getProductBySlug(`legacy-gallery-${suffix}`);
    assert.deepEqual(bySlug.images.map(String), [cloudImage(`legacy-${suffix}`)]);
    const galleries = bySlug.colorImages instanceof Map ? Object.fromEntries(bySlug.colorImages) : (bySlug.colorImages || {});
    assert.deepEqual(galleries, {});
  } finally {
    await cleanupProduct(created._id);
  }
});
