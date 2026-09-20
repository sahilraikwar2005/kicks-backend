import mongoose from 'mongoose';
import Category from './model.js';

export const categoryService = {
  async list() {
    return Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  },

  async getById(id) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid category id');
      error.statusCode = 400;
      throw error;
    }

    const category = await Category.findById(id);
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }
    return category;
  },

  async create(payload) {
    return Category.create({
      name: payload.name,
      slug: payload.slug || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: payload.description || '',
      image: payload.image || '',
      parentId: payload.parentId || null,
      sortOrder: payload.sortOrder || 0,
      isActive: payload.isActive !== false,
    });
  },

  async update(id, payload) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid category id');
      error.statusCode = 400;
      throw error;
    }

    const category = await Category.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }
    return category;
  },

  async remove(id) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid category id');
      error.statusCode = 400;
      throw error;
    }

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }
    return true;
  },
};
