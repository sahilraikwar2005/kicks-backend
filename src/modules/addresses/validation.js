import Joi from 'joi';

export const addressSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(80).required(),
  lastName: Joi.string().trim().min(2).max(80).required(),
  phone: Joi.string().pattern(/^\+?[0-9 ()-]{8,20}$/).required(),
  addressLine1: Joi.string().trim().min(3).max(180).required(),
  addressLine2: Joi.string().trim().max(180).allow('').optional(),
  landmark: Joi.string().trim().max(120).allow('').optional(),
  city: Joi.string().trim().min(2).max(80).required(),
  state: Joi.string().trim().min(2).max(80).required(),
  postalCode: Joi.string().pattern(/^[0-9A-Za-z -]{3,12}$/).required(),
  country: Joi.string().trim().min(2).max(80).default('India'),
  isDefault: Joi.boolean().default(false),
});

export const addressUpdateSchema = addressSchema.fork(Object.keys(addressSchema.describe().keys), (schema) => schema.optional());
