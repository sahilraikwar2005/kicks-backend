import Joi from 'joi';

export const checkoutSchema = Joi.object({
  addressId: Joi.string().hex().length(24).required(),
});
