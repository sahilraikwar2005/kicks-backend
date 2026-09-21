import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import Brand from '../src/modules/brands/model.js';
import { productService } from '../src/modules/products/service.js';
import {
  brandToken,
  buildSku,
  colorCode,
  isWellFormedSku,
  modelToken,
  sanitizeSegment,
  sizeCode,
  withUniqueSuffix,
} from '../src/modules/products/sku.js';

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

const cleanupProducts = async (ids) => {
  await Product.deleteMany({ _id: { $in: ids } });
};

test('SKU sanitization produces compact readable tokens', () => {
  assert.equal(sanitizeSegment("Air Force 1 '07"), 'AIR-FORCE-1-07');
  assert.equal(sanitizeSegment('White / Black'), 'WHITE-BLACK');
  assert.equal(sanitizeSegment('  spaced---out!! '), 'SPACED-OUT');
  assert.equal(sanitizeSegment(''), '');
});

test('SKU color codes shorten common colors deterministically', () => {
  assert.equal(colorCode('White'), 'WHT');
  assert.equal(colorCode('Black'), 'BLK');
  assert.equal(colorCode('Red'), 'RED');
  assert.equal(colorCode('Blue'), 'BLU');
  assert.equal(colorCode('Green'), 'GRN');
  assert.equal(colorCode('Grey'), 'GRY');
  assert.equal(colorCode('Gray'), 'GRY');
  assert.equal(colorCode('Yellow'), 'YLW');
  assert.equal(colorCode('White / Black'), 'WHTBLK');
  assert.equal(colorCode(''), '');
});

test('SKU model and size tokens derive from existing product data', () => {
  assert.equal(modelToken("Air Force 1 '07", 'Nike'), 'AIRFORCE107');
  assert.equal(modelToken('Jordan 1 Retro High', 'Jordan'), '1RETROHIGH');
  assert.equal(modelToken('Samba', 'Adidas'), 'SAMBA');
  assert.equal(brandToken('New Balance'), 'NEWBALANCE');
  assert.equal(sizeCode('UK 8'), 'UK8');
  assert.equal(sizeCode('US 9'), 'US9');
  assert.equal(sizeCode('EU 42'), 'EU42');
});

test('SKU builder emits BRAND-MODEL-COLOR-SIZE without random strings', () => {
  assert.equal(
    buildSku({ brand: 'Nike', model: 'Air Force 1', color: 'White', size: 'UK 8' }),
    'NIKE-AIRFORCE1-WHT-UK8',
  );
  assert.equal(
    buildSku({ brand: 'Jordan', model: 'Jordan 1 Retro High', color: 'Black', size: 'UK 8' }),
    'JORDAN-1RETROHIGH-BLK-UK8',
  );
  assert.equal(
    buildSku({ brand: 'Adidas', model: 'Samba', color: 'Green', size: 'UK 7' }),
    'ADIDAS-SAMBA-GRN-UK7',
  );
  assert.notEqual(
    buildSku({ brand: 'Nike', model: 'Air Force 1', color: 'White', size: 'UK 8' }),
    buildSku({ brand: 'Nike', model: 'Air Force 1', color: 'White', size: 'UK 9' }),
  );
  assert.notEqual(
    buildSku({ brand: 'Nike', model: 'Air Force 1', color: 'White', size: 'UK 8' }),
    buildSku({ brand: 'Nike', model: 'Air Force 1', color: 'Black', size: 'UK 8' }),
  );
});

test('SKU suffix helper only suffixes on real collisions', () => {
  assert.equal(withUniqueSuffix('NIKE-A-WHT-UK8', new Set()), 'NIKE-A-WHT-UK8');
  assert.equal(
    withUniqueSuffix('NIKE-A-WHT-UK8', new Set(['NIKE-A-WHT-UK8', 'NIKE-A-WHT-UK8-2'])),
    'NIKE-A-WHT-UK8-3',
  );
  assert.equal(isWellFormedSku('NIKE-A-WHT-UK8'), true);
  assert.equal(isWellFormedSku('has space'), false);
  assert.equal(isWellFormedSku(''), false);
});

test('product create generates deterministic SKUs when missing', async () => {
  const suffix = uniqueSuffix();
  const brand = await Brand.create({ name: `Sku Brand ${suffix}`, slug: `sku-brand-${suffix}` });
  const createdIds = [];
  try {
    const product = await productService.createProduct({
      name: `Sku Runner ${suffix}`,
      price: 7499,
      brand: brand._id,
      status: 'DRAFT',
      variants: [
        { size: 'UK 8', color: 'White', price: 7499, stock: 4 },
        { size: 'UK 9', color: 'Black', price: 7499, stock: 2 },
      ],
    });
    createdIds.push(product._id);
    const skus = product.variants.map((variant) => variant.sku);
    assert.equal(skus.length, 2);
    assert.ok(skus[0].startsWith('SKUBRAND'));
    assert.ok(skus[0].endsWith('-WHT-UK8'));
    assert.ok(skus[1].endsWith('-BLK-UK9'));
    assert.notEqual(skus[0], skus[1]);
  } finally {
    await cleanupProducts(createdIds);
    await Brand.deleteOne({ _id: brand._id });
  }
});

test('product create regenerates malformed SKUs instead of trusting them', async () => {
  const suffix = uniqueSuffix();
  const createdIds = [];
  try {
    const product = await productService.createProduct({
      name: `Sku Malformed ${suffix}`,
      price: 5000,
      status: 'DRAFT',
      variants: [{ size: 'UK 8', color: 'Black', price: 5000, stock: 1, sku: 'not a valid sku!!' }],
    });
    createdIds.push(product._id);
    assert.equal(isWellFormedSku(product.variants[0].sku), true);
    assert.ok(product.variants[0].sku.endsWith('-BLK-UK8'));
  } finally {
    await cleanupProducts(createdIds);
  }
});

test('product update preserves SKU on stock-only edits', async () => {
  const suffix = uniqueSuffix();
  const createdIds = [];
  try {
    const product = await productService.createProduct({
      name: `Sku Preserve ${suffix}`,
      price: 6000,
      status: 'DRAFT',
      variants: [{ size: 'UK 8', color: 'White', price: 6000, stock: 3, sku: '' }],
    });
    createdIds.push(product._id);
    const originalSku = product.variants[0].sku;
    assert.ok(originalSku.length > 0);

    const updated = await productService.updateProduct(product._id, {
      variants: [{ size: 'UK 8', color: 'White', price: 6000, stock: 9, sku: originalSku }],
    });
    assert.equal(updated.variants[0].sku, originalSku);
    assert.equal(updated.variants[0].stock, 9);
  } finally {
    await cleanupProducts(createdIds);
  }
});

test('product update regenerates SKU when identity changes', async () => {
  const suffix = uniqueSuffix();
  const createdIds = [];
  try {
    const product = await productService.createProduct({
      name: `Sku Rename ${suffix}`,
      price: 6000,
      status: 'DRAFT',
      variants: [{ size: 'UK 8', color: 'White', price: 6000, stock: 3, sku: '' }],
    });
    createdIds.push(product._id);
    const originalSku = product.variants[0].sku;

    const updated = await productService.updateProduct(product._id, {
      name: `Sku Renamed Entirely ${suffix}`,
      variants: [{ size: 'UK 8', color: 'White', price: 6000, stock: 3, sku: '' }],
    });
    assert.notEqual(updated.variants[0].sku, originalSku);
    assert.equal(isWellFormedSku(updated.variants[0].sku), true);
  } finally {
    await cleanupProducts(createdIds);
  }
});

test('generated SKU colliding with another product gets a deterministic suffix', async () => {
  const suffix = uniqueSuffix();
  const createdIds = [];
  try {
    const first = await productService.createProduct({
      name: `Sku Collision ${suffix}`,
      slug: `sku-collision-a-${suffix}`,
      price: 7000,
      status: 'DRAFT',
      variants: [{ size: 'UK 8', color: 'White', price: 7000, stock: 2, sku: '' }],
    });
    createdIds.push(first._id);
    const second = await productService.createProduct({
      name: `Sku Collision ${suffix}`,
      slug: `sku-collision-b-${suffix}`,
      price: 7000,
      status: 'DRAFT',
      variants: [{ size: 'UK 8', color: 'White', price: 7000, stock: 2, sku: '' }],
    });
    createdIds.push(second._id);
    assert.equal(second.variants[0].sku, `${first.variants[0].sku}-2`);
  } finally {
    await cleanupProducts(createdIds);
  }
});

test('legacy valid SKU survives identity-unchanged edits', async () => {
  const suffix = uniqueSuffix();
  const createdIds = [];
  try {
    const product = await productService.createProduct({
      name: `Sku Legacy ${suffix}`,
      price: 8000,
      status: 'DRAFT',
      variants: [{ size: 'UK 8', color: 'Black', price: 8000, stock: 5, sku: `LEGACY-${suffix}`.toUpperCase().replace(/[^A-Z0-9-]+/g, '-') }],
    });
    createdIds.push(product._id);
    const legacySku = product.variants[0].sku;

    const updated = await productService.updateProduct(product._id, {
      variants: [{ size: 'UK 8', color: 'Black', price: 8500, stock: 6, sku: legacySku }],
    });
    assert.equal(updated.variants[0].sku, legacySku);
  } finally {
    await cleanupProducts(createdIds);
  }
});

test('manual SKU colliding with another product cannot bypass uniqueness', async () => {
  const suffix = uniqueSuffix();
  const createdIds = [];
  try {
    const first = await productService.createProduct({
      name: `Sku Guard ${suffix}`,
      price: 7000,
      status: 'DRAFT',
      variants: [{ size: 'UK 8', color: 'White', price: 7000, stock: 2, sku: '' }],
    });
    createdIds.push(first._id);
    await assert.rejects(
      () => productService.createProduct({
        name: `Sku Guard Other ${suffix}`,
        price: 7000,
        status: 'DRAFT',
        variants: [{ size: 'UK 9', color: 'White', price: 7000, stock: 1, sku: first.variants[0].sku }],
      }),
      (error) => error.statusCode === 409,
    );
  } finally {
    await cleanupProducts(createdIds);
  }
});
