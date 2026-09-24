import mongoose from 'mongoose';
import Product from '../products/model.js';
import Inventory, { InventoryMovement } from './model.js';

// Single-operation safety cap for bulk stock adjustments. Normal restocks
// (tens/hundreds of units) pass comfortably; typos like 1000000 are rejected.
const MAX_STOCK_ADJUSTMENT = 10000;

const normalizeQty = (qty) => {
  const amount = Number(qty);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('Stock quantity must be a positive number');
    error.statusCode = 400;
    throw error;
  }
  return amount;
};

const toObjectId = (val) => {
  if (!val) return val;
  if (val instanceof mongoose.Types.ObjectId) return val;
  if (typeof val === 'string' && mongoose.isValidObjectId(val)) {
    return new mongoose.Types.ObjectId(val);
  }
  return val;
};

const syncProductVariantStockDelta = async (productId, variantId, delta) => {
  const pId = toObjectId(productId);
  const vId = toObjectId(variantId);
  if (!pId || !vId || !delta) return;
  await Product.updateOne(
    { _id: pId, 'variants._id': vId },
    { $inc: { 'variants.$.stock': Number(delta) } },
  );
};

const ensureInventory = async (productId, variantId) => {
  const pId = toObjectId(productId);
  const vId = toObjectId(variantId);

  let inventory = await Inventory.findOne({ product: pId, variant: vId });
  if (inventory) {
    return { inventory };
  }

  const product = await Product.findById(pId);
  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  const variant = product.variants.find((item) => String(item._id) === String(vId));
  if (!variant) {
    const error = new Error('Variant not found');
    error.statusCode = 404;
    throw error;
  }

  try {
    inventory = await Inventory.create({
      product: pId,
      variant: vId,
      availableStock: Math.max(0, Number(variant.stock || 0)),
      reservedStock: 0,
      soldStock: 0,
      lowStockThreshold: 5,
    });
  } catch (err) {
    if (err.code === 11000) {
      inventory = await Inventory.findOne({ product: pId, variant: vId });
    } else {
      throw err;
    }
  }

  return { inventory, product, variant };
};

const isAlreadyProcessed = async (productId, variantId, type, metadata = {}) => {
  const referenceId = metadata?.referenceId || '';
  const orderId = metadata?.orderId ? toObjectId(metadata.orderId) : null;
  if (!referenceId && !orderId) return null;

  const query = { product: toObjectId(productId), variant: toObjectId(variantId), type };
  if (referenceId) {
    query.referenceId = referenceId;
  } else if (orderId) {
    query.orderId = orderId;
  }

  return InventoryMovement.findOne(query);
};

export const inventoryService = {
  // Finds the owning product for a variant id. Used by admin flows so variants
  // created by the Add Product workflow work immediately, with no separate
  // inventory setup step (ensureInventory seeds from variant.stock on touch).
  async resolveProductForVariant(variantId) {
    if (!mongoose.isValidObjectId(variantId)) return null;
    const owner = await Product.findOne({ 'variants._id': variantId }).select('_id').lean();
    return owner ? owner._id : null;
  },
  async reserveStock(productId, variantId, quantity, metadata = {}) {
    const qty = normalizeQty(quantity);
    const { inventory } = await ensureInventory(productId, variantId);

    const existingMovement = await isAlreadyProcessed(productId, variantId, 'RESERVATION', metadata);
    if (existingMovement) {
      return Inventory.findById(inventory._id);
    }

    const doc = await Inventory.findOneAndUpdate(
      { _id: inventory._id, availableStock: { $gte: qty } },
      { $inc: { availableStock: -qty, reservedStock: qty } },
      { new: true },
    );
    if (!doc) {
      const error = new Error('Insufficient stock to reserve requested quantity');
      error.statusCode = 409;
      throw error;
    }

    await InventoryMovement.create({
      inventory: doc._id,
      product: toObjectId(productId),
      variant: toObjectId(variantId),
      type: 'RESERVATION',
      quantity: qty,
      referenceId: metadata.referenceId || '',
      orderId: metadata.orderId ? toObjectId(metadata.orderId) : null,
      paymentId: metadata.paymentId || '',
      reason: metadata.reason || 'reservation',
      metadata: metadata.metadata || {},
    });

    await syncProductVariantStockDelta(productId, variantId, -qty);
    return doc;
  },

  async releaseStock(productId, variantId, quantity, metadata = {}) {
    const qty = normalizeQty(quantity);
    const { inventory } = await ensureInventory(productId, variantId);

    const existingMovement = await isAlreadyProcessed(productId, variantId, 'RELEASE', metadata);
    if (existingMovement) {
      return Inventory.findById(inventory._id);
    }

    const doc = await Inventory.findOneAndUpdate(
      { _id: inventory._id, reservedStock: { $gte: qty } },
      { $inc: { availableStock: qty, reservedStock: -qty } },
      { new: true },
    );
    if (!doc) {
      const error = new Error('Cannot release more stock than is reserved');
      error.statusCode = 409;
      throw error;
    }

    await InventoryMovement.create({
      inventory: doc._id,
      product: toObjectId(productId),
      variant: toObjectId(variantId),
      type: 'RELEASE',
      quantity: qty,
      referenceId: metadata.referenceId || '',
      orderId: metadata.orderId ? toObjectId(metadata.orderId) : null,
      paymentId: metadata.paymentId || '',
      reason: metadata.reason || 'release',
      metadata: metadata.metadata || {},
    });

    await syncProductVariantStockDelta(productId, variantId, qty);
    return doc;
  },

  async commitSale(productId, variantId, quantity, metadata = {}) {
    const qty = normalizeQty(quantity);
    const { inventory } = await ensureInventory(productId, variantId);

    const existingMovement = await isAlreadyProcessed(productId, variantId, 'SALE', metadata);
    if (existingMovement) {
      return Inventory.findById(inventory._id);
    }

    let doc = await Inventory.findOneAndUpdate(
      { _id: inventory._id, reservedStock: { $gte: qty } },
      { $inc: { reservedStock: -qty, soldStock: qty } },
      { new: true },
    );

    if (!doc) {
      doc = await Inventory.findOneAndUpdate(
        { _id: inventory._id, availableStock: { $gte: qty } },
        { $inc: { availableStock: -qty, soldStock: qty } },
        { new: true },
      );
      if (doc) {
        await syncProductVariantStockDelta(productId, variantId, -qty);
      }
    }

    if (!doc) {
      const error = new Error('Insufficient stock to commit sale');
      error.statusCode = 409;
      throw error;
    }

    await InventoryMovement.create({
      inventory: doc._id,
      product: toObjectId(productId),
      variant: toObjectId(variantId),
      type: 'SALE',
      quantity: qty,
      referenceId: metadata.referenceId || '',
      orderId: metadata.orderId ? toObjectId(metadata.orderId) : null,
      paymentId: metadata.paymentId || '',
      reason: metadata.reason || 'sale',
      metadata: metadata.metadata || {},
    });

    return doc;
  },

  async restoreStock(productId, variantId, quantity, metadata = {}) {
    const qty = normalizeQty(quantity);
    const { inventory } = await ensureInventory(productId, variantId);

    const existingMovement = await isAlreadyProcessed(productId, variantId, 'REFUND', metadata);
    if (existingMovement) {
      return Inventory.findById(inventory._id);
    }

    const doc = await Inventory.findOneAndUpdate(
      { _id: inventory._id, soldStock: { $gte: qty } },
      { $inc: { soldStock: -qty, availableStock: qty } },
      { new: true },
    );
    if (!doc) {
      const error = new Error('Cannot restore more units than were sold');
      error.statusCode = 409;
      throw error;
    }

    await InventoryMovement.create({
      inventory: doc._id,
      product: toObjectId(productId),
      variant: toObjectId(variantId),
      type: 'REFUND',
      quantity: qty,
      referenceId: metadata.referenceId || '',
      orderId: metadata.orderId ? toObjectId(metadata.orderId) : null,
      paymentId: metadata.paymentId || '',
      reason: metadata.reason || 'refund',
      metadata: metadata.metadata || {},
    });

    await syncProductVariantStockDelta(productId, variantId, qty);
    return doc;
  },

  async adjustStock(productId, variantId, delta, metadata = {}) {
    const adjustment = Number(delta);
    if (!Number.isFinite(adjustment) || adjustment === 0) {
      const error = new Error('Adjustment value must be a non-zero number');
      error.statusCode = 400;
      throw error;
    }
    // Bulk adjustments are single atomic $inc operations, but fractional or
    // absurd quantities must never reach stock counts.
    if (!Number.isInteger(adjustment)) {
      const error = new Error('Adjustment quantity must be a whole number of units');
      error.statusCode = 400;
      throw error;
    }
    if (Math.abs(adjustment) > MAX_STOCK_ADJUSTMENT) {
      const error = new Error(`Adjustment quantity must not exceed ${MAX_STOCK_ADJUSTMENT} units per operation`);
      error.statusCode = 400;
      throw error;
    }

    const { inventory } = await ensureInventory(productId, variantId);

    const query = { _id: inventory._id };
    if (adjustment < 0) {
      query.availableStock = { $gte: Math.abs(adjustment) };
    }

    const doc = await Inventory.findOneAndUpdate(
      query,
      { $inc: { availableStock: adjustment } },
      { new: true },
    );

    if (!doc) {
      const error = new Error('Cannot remove more stock than currently available.');
      error.statusCode = 409;
      throw error;
    }

    await InventoryMovement.create({
      inventory: doc._id,
      product: toObjectId(productId),
      variant: toObjectId(variantId),
      type: 'ADJUSTMENT',
      quantity: Math.abs(adjustment),
      referenceId: metadata.referenceId || '',
      orderId: metadata.orderId ? toObjectId(metadata.orderId) : null,
      paymentId: metadata.paymentId || '',
      reason: metadata.reason || 'adjustment',
      metadata: { delta: adjustment, ...((metadata.metadata) || {}) },
    });

    await syncProductVariantStockDelta(productId, variantId, adjustment);
    return doc;
  },

  async getInventory(filters = {}) {
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 20);
    const skip = (page - 1) * limit;
    const query = {};
    if (filters.productId) query.product = filters.productId;
    if (filters.variantId) query.variant = filters.variantId;
    if (filters.lowStock) query.availableStock = { $lte: filters.lowStockThreshold || 5 };

    const [items, total] = await Promise.all([
      Inventory.find(query).populate('product', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Inventory.countDocuments(query),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getLowStock() {
    return Inventory.find({ availableStock: { $lte: 5 } }).populate('product', 'name slug').lean();
  },

  async getMovementHistory(filters = {}) {
    const query = {};
    if (filters.productId) query.product = filters.productId;
    if (filters.variantId) query.variant = filters.variantId;
    if (filters.type) query.type = filters.type;
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 20);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryMovement.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InventoryMovement.countDocuments(query),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },
};

export default inventoryService;
