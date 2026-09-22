import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { inventoryService } from '../src/modules/inventory/service.js';
import { productService } from '../src/modules/products/service.js';

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

const cleanupProduct = async (productId) => {
  await Product.deleteOne({ _id: productId });
  await Inventory.deleteMany({ product: productId });
  await InventoryMovement.deleteMany({ product: productId });
};

const makeVariant = (size, color, stock, sku = '') => ({ size, color, price: 11000, stock, sku });

test('matrix: one size and one color creates a single variant', async () => {
  const suffix = uniqueSuffix();
  const product = await productService.createProduct({
    name: `Matrix 1x1 ${suffix}`,
    slug: `matrix-1x1-${suffix}`,
    price: 11000,
    status: 'DRAFT',
    variants: [makeVariant('UK 5', 'Black', 6)],
  });
  try {
    assert.equal(product.variants.length, 1);
    assert.equal(product.variants[0].stock, 6);
    assert.match(product.variants[0].sku, /-BLK-UK5$/);
  } finally {
    await cleanupProduct(product._id);
  }
});

test('matrix: multiple sizes with one color creates one row per size', async () => {
  const suffix = uniqueSuffix();
  const product = await productService.createProduct({
    name: `Matrix Nx1 ${suffix}`,
    slug: `matrix-nx1-${suffix}`,
    price: 11000,
    status: 'DRAFT',
    variants: [makeVariant('UK 5', 'Black', 6), makeVariant('UK 6', 'Black', 5), makeVariant('UK 7', 'Black', 4)],
  });
  try {
    assert.equal(product.variants.length, 3);
    const skus = new Set(product.variants.map((variant) => variant.sku));
    assert.equal(skus.size, 3);
  } finally {
    await cleanupProduct(product._id);
  }
});

test('matrix: one size with multiple colors creates one row per color', async () => {
  const suffix = uniqueSuffix();
  const product = await productService.createProduct({
    name: `Matrix 1xN ${suffix}`,
    slug: `matrix-1xn-${suffix}`,
    price: 11000,
    status: 'DRAFT',
    variants: [makeVariant('UK 5', 'Black', 6), makeVariant('UK 5', 'White', 4)],
  });
  try {
    assert.equal(product.variants.length, 2);
    assert.notEqual(product.variants[0].sku, product.variants[1].sku);
    assert.ok(product.variants.some((variant) => /-BLK-UK5$/.test(variant.sku)));
    assert.ok(product.variants.some((variant) => /-WHT-UK5$/.test(variant.sku)));
  } finally {
    await cleanupProduct(product._id);
  }
});

test('matrix: 3 sizes x 2 colors creates six variants with independent stock', async () => {
  const suffix = uniqueSuffix();
  const product = await productService.createProduct({
    name: `Matrix 3x2 ${suffix}`,
    slug: `matrix-3x2-${suffix}`,
    price: 11000,
    status: 'DRAFT',
    variants: [
      makeVariant('UK 5', 'Black', 6),
      makeVariant('UK 5', 'White', 4),
      makeVariant('UK 6', 'Black', 5),
      makeVariant('UK 6', 'White', 3),
      makeVariant('UK 7', 'Black', 2),
      makeVariant('UK 7', 'White', 1),
    ],
  });
  try {
    assert.equal(product.variants.length, 6);
    assert.equal(new Set(product.variants.map((variant) => variant.sku)).size, 6);
    const stocks = Object.fromEntries(product.variants.map((variant) => [`${variant.size}/${variant.color}`, variant.stock]));
    assert.equal(stocks['UK 5/Black'], 6);
    assert.equal(stocks['UK 5/White'], 4);
  } finally {
    await cleanupProduct(product._id);
  }
});

test('matrix: duplicate Size + Color in one request is rejected', async () => {
  const suffix = uniqueSuffix();
  const createdIds = [];
  try {
    await assert.rejects(
      () => productService.createProduct({
        name: `Matrix Dup ${suffix}`,
        slug: `matrix-dup-${suffix}`,
        price: 11000,
        status: 'DRAFT',
        variants: [makeVariant('UK 5', 'Black', 6), makeVariant('UK 5', 'Black', 1, 'MANUAL-DUP-1')],
      }),
      (error) => error.statusCode === 400 && /duplicate variant combination/i.test(error.message),
    );
  } finally {
    await cleanupProduct({ _id: { $in: createdIds } }).catch(() => {});
  }
});

test('matrix: duplicate Size + Color with different casing is rejected', async () => {
  const suffix = uniqueSuffix();
  try {
    await assert.rejects(
      () => productService.createProduct({
        name: `Matrix Case ${suffix}`,
        slug: `matrix-case-${suffix}`,
        price: 11000,
        status: 'DRAFT',
        variants: [makeVariant('UK 5', 'Black', 6), makeVariant('uk 5', 'BLACK', 1, 'MANUAL-DUP-2')],
      }),
      (error) => error.statusCode === 400 && /duplicate variant combination/i.test(error.message),
    );
  } finally {
    await Product.deleteMany({ slug: `matrix-case-${suffix}` });
  }
});

test('matrix: same size with different colors is allowed', async () => {
  const suffix = uniqueSuffix();
  let product = null;
  try {
    product = await productService.createProduct({
      name: `Matrix Allowed ${suffix}`,
      slug: `matrix-allowed-${suffix}`,
      price: 11000,
      status: 'DRAFT',
      variants: [makeVariant('UK 5', 'Black', 6), makeVariant('UK 5', 'White', 4)],
    });
    assert.equal(product.variants.length, 2);
  } finally {
    if (product) await cleanupProduct(product._id);
  }
});

test('matrix: adding a color on edit preserves existing variant data', async () => {
  const suffix = uniqueSuffix();
  let product = null;
  try {
    product = await productService.createProduct({
      name: `Matrix Edit ${suffix}`,
      slug: `matrix-edit-${suffix}`,
      price: 11000,
      status: 'DRAFT',
      variants: [makeVariant('UK 5', 'Black', 6), makeVariant('UK 6', 'Black', 5)],
    });
    const blackSkus = Object.fromEntries(
      product.variants.map((variant) => [`${variant.size}/${variant.color}`, variant.sku]),
    );
    const updated = await productService.updateProduct(product._id, {
      variants: [
        { ...makeVariant('UK 5', 'Black', 6), sku: blackSkus['UK 5/Black'] },
        { ...makeVariant('UK 6', 'Black', 5), sku: blackSkus['UK 6/Black'] },
        makeVariant('UK 5', 'White', 0),
        makeVariant('UK 6', 'White', 0),
      ],
    });
    assert.equal(updated.variants.length, 4);
    const after = Object.fromEntries(updated.variants.map((variant) => [`${variant.size}/${variant.color}`, variant]));
    assert.equal(after['UK 5/Black'].stock, 6);
    assert.equal(after['UK 6/Black'].stock, 5);
    assert.equal(after['UK 5/Black'].sku, blackSkus['UK 5/Black']);
    assert.equal(after['UK 6/Black'].sku, blackSkus['UK 6/Black']);
    assert.equal(after['UK 5/White'].stock, 0);
    assert.ok(/-WHT-UK5$/.test(after['UK 5/White'].sku));
  } finally {
    if (product) await cleanupProduct(product._id);
  }
});

test('matrix: inventory decrement targets the exact Size + Color variant', async () => {
  const suffix = uniqueSuffix();
  let product = null;
  try {
    product = await productService.createProduct({
      name: `Matrix Stock ${suffix}`,
      slug: `matrix-stock-${suffix}`,
      price: 11000,
      status: 'DRAFT',
      variants: [makeVariant('UK 8', 'Black', 6), makeVariant('UK 8', 'White', 4)],
    });
    const black = product.variants.find((variant) => variant.color === 'Black');
    await inventoryService.adjustStock(product._id, black._id, -1, { reason: 'Offline sale' });
    const refreshed = await Product.findById(product._id).lean();
    const stocks = Object.fromEntries(refreshed.variants.map((variant) => [`${variant.size}/${variant.color}`, variant.stock]));
    assert.equal(stocks['UK 8/Black'], 5);
    assert.equal(stocks['UK 8/White'], 4);
  } finally {
    if (product) await cleanupProduct(product._id);
  }
});

test('matrix: all variants at zero stock persists every zero row', async () => {
  const suffix = uniqueSuffix();
  let product = null;
  try {
    product = await productService.createProduct({
      name: `Matrix Zero ${suffix}`,
      slug: `matrix-zero-${suffix}`,
      price: 11000,
      status: 'DRAFT',
      variants: [makeVariant('UK 5', 'Black', 0), makeVariant('UK 5', 'White', 0)],
    });
    const refreshed = await Product.findById(product._id).lean();
    assert.ok(refreshed.variants.length === 2 && refreshed.variants.every((variant) => variant.stock === 0));
  } finally {
    if (product) await cleanupProduct(product._id);
  }
});
