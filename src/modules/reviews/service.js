import mongoose from 'mongoose';
import Review from './model.js';
import Order from '../orders/model.js';
import { adminSettingsService } from '../admin/settings.service.js';

export const reviewService = {
  async listApproved(productId) {
    return Review.find({ product: productId, status: 'APPROVED' }).populate('user', 'firstName lastName').sort({ createdAt: -1 });
  },

  async create(userId, productId, payload) {
    if (!mongoose.isValidObjectId(productId)) { const error = new Error('Invalid product id'); error.statusCode = 400; throw error; }
    if (!(await adminSettingsService.isReviewsEnabled())) { const error = new Error('Product reviews are currently disabled'); error.statusCode = 403; throw error; }
    const order = await Order.findOne({ user: userId, paymentStatus: 'PAID', status: 'DELIVERED', 'items.productId': productId });
    if (!order) { const error = new Error('You can review only products purchased in a paid order'); error.statusCode = 403; throw error; }
    try {
      return await Review.create({ ...payload, product: productId, user: userId, order: order._id });
    } catch (error) {
      if (error.code === 11000) { error.statusCode = 409; error.message = 'You already reviewed this purchase'; }
      throw error;
    }
  },
};
