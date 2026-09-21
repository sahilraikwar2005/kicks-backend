import test from 'node:test';
import assert from 'node:assert/strict';

import { cartService } from '../src/modules/cart/service.js';
import { productService } from '../src/modules/products/service.js';

test('cartService validates quantity as positive integer', () => {
  assert.throws(() => cartService.validateQuantity(0), /positive integer/i);
  assert.throws(() => cartService.validateQuantity(-1), /positive integer/i);
  assert.throws(() => cartService.validateQuantity(1.5), /positive integer/i);
  assert.doesNotThrow(() => cartService.validateQuantity(2));
});

test('productService detects duplicate variant SKUs across a product payload', () => {
  const variants = [
    { sku: 'SKU-1', size: '8', color: 'Black' },
    { sku: 'SKU-1', size: '9', color: 'White' },
  ];

  assert.throws(() => productService.validateVariantSkuUniqueness(variants), /unique/i);
});
