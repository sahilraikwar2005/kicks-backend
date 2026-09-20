import mongoose from 'mongoose';
import Brand from './model.js';

export const brandService = {
  async list() {
    return Brand.find({ isActive: true }).sort({ name: 1 });
  },

  async getById(id) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid brand id');
      error.statusCode = 400;
      throw error;
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      const error = new Error('Brand not found');
      error.statusCode = 404;
      throw error;
    }
    return brand;
  },

  async create(payload) {
    return Brand.create({
      name: payload.name,
      slug: payload.slug || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: payload.description || '',
      logo: payload.logo || '',
      isActive: payload.isActive !== false,
    });
  },

  async update(id, payload) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid brand id');
      error.statusCode = 400;
      throw error;
    }

    const brand = await Brand.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!brand) {
      const error = new Error('Brand not found');
      error.statusCode = 404;
      throw error;
    }
    return brand;
  },

  async remove(id) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid brand id');
      error.statusCode = 400;
      throw error;
    }

    const brand = await Brand.findByIdAndDelete(id);
    if (!brand) {
      const error = new Error('Brand not found');
      error.statusCode = 404;
      throw error;
    }
    return true;
  },
};
