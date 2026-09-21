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
    const name = String(payload?.name || '').trim().replace(/\s+/g, ' ');
    if (!name) {
      const error = new Error('Brand name is required');
      error.statusCode = 400;
      throw error;
    }
    if (name.length > 60) {
      const error = new Error('Brand name must be 60 characters or fewer');
      error.statusCode = 400;
      throw error;
    }
    const slug = (payload?.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    // Case-insensitive duplicate guard: Nike / nike / " NIKE " share one slug.
    const duplicate = await Brand.findOne({ slug });
    if (duplicate) {
      const error = new Error('Brand already exists');
      error.statusCode = 409;
      throw error;
    }
    try {
      return await Brand.create({
        name,
        slug,
        description: payload?.description || '',
        logo: payload?.logo || '',
        isActive: payload?.isActive !== false,
      });
    } catch (error) {
      // Race safety: two concurrent creates for the same brand.
      if (error?.code === 11000) {
        const conflict = new Error('Brand already exists');
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
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
