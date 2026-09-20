import Joi from 'joi';

export const adminAiGenerateSchema = Joi.object({
  prompt: Joi.string().allow('').optional(),
  imageUrl: Joi.string().uri().allow('').optional(),
  field: Joi.string().valid('name', 'shortDescription', 'description', 'category', 'gender', 'color', 'style', 'tags', 'seoTitle', 'seoDescription', 'slug', 'altText').optional(),
  previousValue: Joi.any().optional(),
});
