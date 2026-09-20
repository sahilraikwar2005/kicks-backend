import mongoose from 'mongoose';
import Cart from './model.js';
import Product from '../products/model.js';

const validateQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    const error = new Error('Quantity must be a positive integer');
    error.statusCode = 400;
    throw error;
  }
  return quantity;
};

export const cartService = {
  validateQuantity,

  async getCart(userId) {
    if (!mongoose.isValidObjectId(userId)) {
      const error = new Error('Invalid user id');
      error.statusCode = 400;
      throw error;
    }

    let cart = await Cart.findOne({ userId }).lean();
    if (!cart) {
      cart = { userId, items: [] };
    }
    return cart;
  },

  async addItem(userId, payload) {
    if (!mongoose.isValidObjectId(userId)) {
      const error = new Error('Invalid user id');
      error.statusCode = 400;
      throw error;
    }

    const quantity = validateQuantity(payload.quantity);
    const product = await Product.findById(payload.productId);
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    const variant = product.variants.find((item) => String(item._id) === String(payload.variantId));
    if (!variant) {
      const error = new Error('Variant not found');
      error.statusCode = 404;
      throw error;
    }

    if (variant.stock < quantity) {
      const error = new Error('Requested quantity exceeds available stock');
      error.statusCode = 400;
      throw error;
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find((item) => String(item.variantId) === String(payload.variantId));
    if (existingItem) {
      existingItem.quantity += quantity;
      if (existingItem.quantity > variant.stock) {
        throw new Error('Requested quantity exceeds available stock');
      }
    } else {
      cart.items.push({
        productId: product._id,
        variantId: variant._id,
        size: variant.size,
        color: variant.color,
        quantity,
        unitPrice: variant.salePrice ?? variant.price,
      });
    }

    await cart.save();
    return cart.toObject();
  },

  async updateItem(userId, variantId, quantity) {
    const normalizedQuantity = validateQuantity(quantity);
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      const error = new Error('Cart not found');
      error.statusCode = 404;
      throw error;
    }

    const item = cart.items.find((entry) => String(entry.variantId) === String(variantId));
    if (!item) {
      const error = new Error('Cart item not found');
      error.statusCode = 404;
      throw error;
    }

    const product = await Product.findById(item.productId);
    const variant = product.variants.find((entry) => String(entry._id) === String(variantId));
    if (!variant) {
      const error = new Error('Variant not found');
      error.statusCode = 404;
      throw error;
    }

    if (normalizedQuantity > variant.stock) {
      const error = new Error('Requested quantity exceeds available stock');
      error.statusCode = 400;
      throw error;
    }

    item.quantity = normalizedQuantity;
    await cart.save();
    return cart.toObject();
  },

  async removeItem(userId, variantId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      const error = new Error('Cart not found');
      error.statusCode = 404;
      throw error;
    }

    cart.items = cart.items.filter((item) => String(item.variantId) !== String(variantId));
    await cart.save();
    return cart.toObject();
  },

  async clearCart(userId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return { userId, items: [] };
    }
    cart.items = [];
    await cart.save();
    return cart.toObject();
  },
};
