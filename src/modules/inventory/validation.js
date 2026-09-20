import Joi from 'joi';

export const inventoryAdjustSchema = Joi.object({
  delta: Joi.number().required(),
  reason: Joi.string().trim().max(200).optional().allow(''),
  referenceId: Joi.string().trim().max(120).optional().allow(''),
});

export const inventoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  productId: Joi.string().optional(),
  lowStock: Joi.boolean().optional(),
});
