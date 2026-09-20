import Joi from 'joi';

export const addCartItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  variantId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(99).required(),
});

export const updateCartItemSchema = Joi.object({ quantity: Joi.number().integer().min(1).max(99).required() });
