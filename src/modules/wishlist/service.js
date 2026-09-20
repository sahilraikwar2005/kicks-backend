import mongoose from 'mongoose';
import Wishlist from './model.js';
import Product from '../products/model.js';

export const wishlistService = {
  async getWishlist(userId) {
    let wishlist = await Wishlist.findOne({ userId }).populate('productIds');
    if (!wishlist) {
      wishlist = { userId, productIds: [] };
    }
    return wishlist;
  },

  async addToWishlist(userId, productId) {
    if (!mongoose.isValidObjectId(productId)) {
      const error = new Error('Invalid product id');
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, productIds: [] });
    }

    if (!wishlist.productIds.some((id) => String(id) === String(productId))) {
      wishlist.productIds.push(productId);
      await wishlist.save();
    }

    return wishlist.toObject();
  },

  async removeFromWishlist(userId, productId) {
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return { userId, productIds: [] };
    }

    wishlist.productIds = wishlist.productIds.filter((id) => String(id) !== String(productId));
    await wishlist.save();
    return wishlist.toObject();
  },
};
