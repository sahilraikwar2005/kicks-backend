import test from 'node:test';
import assert from 'node:assert/strict';
import {
  colorsWithGalleries,
  getColorImages,
  resolveGalleryImages,
  sizesForColor,
  variantColors,
  variantForSelection,
} from '../kicks-frontend/src/utils/productGallery.js';

const BLACK = ['black-front.jpg', 'black-side.jpg', 'black-back.jpg'];
const WHITE = ['white-front.jpg', 'white-side.jpg', 'white-back.jpg'];

const product = {
  images: ['general-1.jpg', 'general-2.jpg'],
  colorImages: { Black: [...BLACK], White: [...WHITE] },
  variants: [
    { _id: 'bb5', size: 'UK 5', color: 'Black', price: 10000, stock: 6 },
    { _id: 'wb5', size: 'UK 5', color: 'White', price: 11000, stock: 4 },
    { _id: 'bb6', size: 'UK 6', color: 'Black', price: 10000, stock: 0 },
  ],
};

test('15-16. each color resolves its own dedicated gallery', () => {
  assert.deepEqual(getColorImages(product, 'Black'), BLACK);
  assert.deepEqual(getColorImages(product, 'White'), WHITE);
  assert.deepEqual(getColorImages(product, 'black'), BLACK);
  assert.deepEqual(getColorImages(product, 'Red'), []);
  assert.deepEqual(getColorImages({}, 'Black'), []);
  assert.deepEqual(getColorImages(product, ''), []);
});

test('colorsWithGalleries lists only colors that have images', () => {
  assert.deepEqual(colorsWithGalleries(product), ['Black', 'White']);
  assert.deepEqual(colorsWithGalleries({ colorImages: { Black: [], White: [...WHITE] } }), ['White']);
  assert.deepEqual(colorsWithGalleries({}), []);
});

test('19-21. gallery resolution prefers variant, then color, then product images', () => {
  assert.deepEqual(
    resolveGalleryImages({ product, variant: { images: ['variant-only.jpg'] }, color: 'Black' }),
    ['variant-only.jpg'],
  );
  assert.deepEqual(resolveGalleryImages({ product, variant: {}, color: 'White' }), WHITE);
  assert.deepEqual(resolveGalleryImages({ product, variant: {}, color: 'Black' }), BLACK);
});

test('switching colors changes the resolved gallery', () => {
  const before = resolveGalleryImages({ product, variant: {}, color: 'Black' });
  const after = resolveGalleryImages({ product, variant: {}, color: 'White' });
  assert.notDeepEqual(before, after);
  assert.deepEqual(after, WHITE);
});

test('22. color without dedicated images falls back to product.images[]', () => {
  const fallbackProduct = { images: ['general-1.jpg'], colorImages: { Black: [...BLACK] }, variants: [] };
  assert.deepEqual(resolveGalleryImages({ product: fallbackProduct, variant: {}, color: 'Red' }), ['general-1.jpg']);
  assert.deepEqual(resolveGalleryImages({ product: { images: [] }, variant: {}, color: 'Red' }), []);
});

test('24. image order is preserved per color', () => {
  assert.deepEqual(getColorImages(product, 'Black'), ['black-front.jpg', 'black-side.jpg', 'black-back.jpg']);
});

test('variantColors lists distinct variant colors', () => {
  assert.deepEqual(variantColors(product.variants), ['Black', 'White']);
  assert.deepEqual(variantColors([]), []);
});

test('sizesForColor returns only sizes existing for that color', () => {
  assert.deepEqual(sizesForColor(product.variants, 'Black'), ['UK 5', 'UK 6']);
  assert.deepEqual(sizesForColor(product.variants, 'White'), ['UK 5']);
  assert.deepEqual(sizesForColor(product.variants, 'Red'), []);
});

test('31-32. selection resolves the exact variant, never a cross-color fallback', () => {
  const blackUk5 = variantForSelection(product.variants, 'UK 5', 'Black');
  const whiteUk5 = variantForSelection(product.variants, 'UK 5', 'White');
  assert.equal(blackUk5._id, 'bb5');
  assert.equal(whiteUk5._id, 'wb5');
  assert.notEqual(blackUk5._id, whiteUk5._id);
  assert.equal(variantForSelection(product.variants, 'UK 7', 'Black'), null);
  assert.equal(variantForSelection(product.variants, 'UK 5', 'Red'), null);
});
