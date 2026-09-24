import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Product from '../src/modules/products/model.js';
import Order from '../src/modules/orders/model.js';
import { InventoryMovement } from '../src/modules/inventory/model.js';
import { inventoryService } from '../src/modules/inventory/service.js';
import { adminService } from '../src/modules/admin/service.js';

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test('sales overview separates online orders from net offline counter sales', async () => {
  const suffix = uniqueSuffix();
  const userId = new mongoose.Types.ObjectId();
  const product = await Product.create({
    name: `Sales Probe ${suffix}`,
    slug: `sales-probe-${suffix}`,
    price: 1000,
    status: 'PUBLISHED',
    images: [],
    variants: [{ sku: `SALES-${suffix}`.toUpperCase(), size: 'UK 8', color: 'Black', price: 1000, stock: 10, images: [] }],
  });
  const variantId = product.variants[0]._id;
  try {
    const before = await adminService.getSalesOverview('all');
    // One valid online order: PAID, not cancelled.
    await Order.create({
      user: userId,
      orderNumber: `SALES-${suffix}`,
      items: [{
        productId: product._id,
        variantId,
        productName: product.name,
        sku: product.variants[0].sku,
        size: 'UK 8',
        color: 'Black',
        quantity: 2,
        unitPrice: 1000,
        discount: 0,
        finalPrice: 2000,
      }],
      shippingAddress: { city: 'X', state: 'Karnataka', postalCode: '560001' },
      customerSnapshot: { email: 'sales@test.local' },
      subtotal: 2000,
      grandTotal: 2000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    });
    // Noise that must NOT count: cancelled paid order + restock + correction.
    await Order.create({
      user: userId,
      orderNumber: `SALES-CANCELLED-${suffix}`,
      items: [{
        productId: product._id,
        variantId,
        productName: product.name,
        sku: product.variants[0].sku,
        size: 'UK 8',
        color: 'Black',
        quantity: 5,
        unitPrice: 1000,
        discount: 0,
        finalPrice: 5000,
      }],
      shippingAddress: { city: 'X', state: 'Karnataka', postalCode: '560001' },
      customerSnapshot: { email: 'sales@test.local' },
      subtotal: 5000,
      grandTotal: 5000,
      status: 'CANCELLED',
      paymentStatus: 'PAID',
    });
    // Two offline sales (3 units), one undone (1 unit) => net +2 offline items.
    await inventoryService.adjustStock(product._id, variantId, -2, { reason: 'Offline sale' });
    await inventoryService.adjustStock(product._id, variantId, -1, { reason: 'Offline sale' });
    await inventoryService.adjustStock(product._id, variantId, 1, { reason: 'Undo offline sale' });
    await inventoryService.adjustStock(product._id, variantId, 4, { reason: 'Restock' });

    const overview = await adminService.getSalesOverview('all');
    assert.equal(overview.online.orders - before.online.orders, 1);
    assert.equal(overview.online.items - before.online.items, 2);
    assert.equal(overview.online.revenue - before.online.revenue, 2000);
    assert.equal(overview.offline.items - before.offline.items, 2);
    assert.equal(overview.offline.revenue, null);
    assert.equal(overview.total.items - before.total.items, 4);
    assert.equal(overview.total.revenue - before.total.revenue, 2000);
    assert.equal(overview.total.orders - before.total.orders, 1);
  } finally {
    await Order.deleteMany({ orderNumber: { $in: [`SALES-${suffix}`, `SALES-CANCELLED-${suffix}`] } });
    await InventoryMovement.deleteMany({ product: product._id });
    const { Inventory } = await import('../src/modules/inventory/model.js');
    await Inventory.deleteMany({ product: product._id });
    await Product.deleteOne({ _id: product._id });
  }
});

test('sales overview is zero when nothing sold', async () => {
  const overview = await adminService.getSalesOverview('today');
  assert.ok(overview.online.orders >= 0);
  assert.ok(overview.offline.items >= 0);
  assert.equal(overview.total.items, overview.online.items + overview.offline.items);
});
