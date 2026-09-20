import test from 'node:test';
import assert from 'node:assert/strict';

import { couponService } from '../src/modules/coupons/service.js';
import { cartService } from '../src/modules/cart/service.js';
import { productService } from '../src/modules/products/service.js';

// Coupon rules

test('validateCoupon rejects expired coupons and enforces minimum cart value', async () => {
  const { validateCoupon } = couponService;
  const Coupon = (await import('../src/modules/coupons/model.js')).default;
  const original = Coupon.findOne;
  Coupon.findOne = async () => ({
    code: 'SAVE10',
    active: true,
    expiryDate: new Date(Date.now() - 60_000),
    minCartValue: 2000,
    usageLimit: 0,
    perUserLimit: 1,
    firstOrderOnly: false,
    productRestrictions: [],
    categoryRestrictions: [],
    type: 'PERCENTAGE',
    value: 10,
    maxDiscount: 200,
    usedCount: 0,
    userUsage: [],
  });

  await assert.rejects(() => validateCoupon('SAVE10', '507f1f77bcf86cd799439011', 1500), /expired|minimum cart/i);
  Coupon.findOne = original;
});

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
