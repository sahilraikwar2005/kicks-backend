import mongoose from 'mongoose';
import RecentlyViewed from './model.js';
import Product from '../products/model.js';

const validate = (id) => { if (!mongoose.isValidObjectId(id)) { const error = new Error('Invalid product id'); error.statusCode = 400; throw error; } };

export const recentlyViewedService = {
  async add(userId, productId) {
    validate(productId);
    if (!(await Product.exists({ _id: productId, status: 'PUBLISHED' }))) { const error = new Error('Product not found'); error.statusCode = 404; throw error; }
    let record = await RecentlyViewed.findOne({ user: userId });
    if (!record) record = new RecentlyViewed({ user: userId, products: [] });
    record.products = record.products.filter((item) => String(item.product) !== String(productId));
    record.products.unshift({ product: productId, viewedAt: new Date() });
    record.products = record.products.slice(0, 30);
    await record.save();
    return record;
  },
  async list(userId) { const record = await RecentlyViewed.findOne({ user: userId }).populate('products.product'); return record?.products || []; },
  async clear(userId) { await RecentlyViewed.deleteOne({ user: userId }); return true; },
};
