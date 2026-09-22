import Joi from 'joi';

export const listProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  category: Joi.string().allow('').optional(),
  brand: Joi.string().allow('').optional(),
  gender: Joi.string().allow('').optional(),
  search: Joi.string().allow('').optional(),
  minPrice: Joi.number().min(0).allow('').optional(),
  maxPrice: Joi.number().min(0).allow('').optional(),
  size: Joi.string().allow('').optional(),
  color: Joi.string().allow('').optional(),
  sort: Joi.string().valid('newest', 'price_asc', 'price_desc', 'featured').default('newest'),
});

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  slug: Joi.string().trim().allow('').optional(),
  brand: Joi.string().allow('').optional(),
  category: Joi.string().allow('').optional(),
  gender: Joi.string().valid('MEN', 'WOMEN', 'UNISEX', 'KIDS').optional(),
  description: Joi.string().allow('').optional(),
  shortDescription: Joi.string().allow('').optional(),
  tags: Joi.array().items(Joi.string()).default([]),
  price: Joi.number().min(0).required(),
  salePrice: Joi.number().min(0).allow(null, '').optional(),
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
  featured: Joi.boolean().optional(),
  newArrival: Joi.boolean().optional(),
  bestSeller: Joi.boolean().optional(),
  images: Joi.array().items(Joi.string().allow('')).optional(),
  variants: Joi.array().items(
    Joi.object({
      sku: Joi.string().allow('').optional(),
      size: Joi.string().allow('').optional(),
      color: Joi.string().allow('').optional(),
      price: Joi.number().min(0).allow('').optional(),
      salePrice: Joi.number().min(0).allow(null, '').optional(),
      stock: Joi.number().integer().min(0).allow('').optional(),
      images: Joi.array().items(Joi.string().allow('')).optional(),
      status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
    }).unknown(false),
  ).optional(),
});
