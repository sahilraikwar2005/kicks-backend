import Joi from 'joi';
import { canonicalState } from './indiaLocations.js';

// Indian PIN codes are 6 digits and never start with 0. A bare 6-digit
// numeric check is not enough on its own, so the frontend additionally
// verifies existence via pincode lookup before submit.
const indiaPostalCode = Joi.string()
  .trim()
  .pattern(/^[1-9][0-9]{5}$/)
  .required()
  .messages({ 'string.pattern.base': 'Enter a valid 6-digit Indian PIN code.' });

// States resolve against the official states/UTs list (full names and
// standard codes such as MH, DL, KA are accepted).
const indiaState = Joi.string()
  .trim()
  .min(2)
  .max(80)
  .required()
  .custom((value, helpers) => {
    if (!canonicalState(value)) return helpers.error('any.invalid');
    return value;
  })
  .messages({ 'any.invalid': 'Select a valid Indian state.' });

export const addressSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(80).required(),
  lastName: Joi.string().trim().min(2).max(80).required(),
  phone: Joi.string().pattern(/^\+?[0-9 ()-]{8,20}$/).required(),
  addressLine1: Joi.string().trim().min(3).max(180).required(),
  addressLine2: Joi.string().trim().max(180).allow('').optional(),
  landmark: Joi.string().trim().max(120).allow('').optional(),
  city: Joi.string().trim().min(2).max(80).required(),
  state: indiaState,
  postalCode: indiaPostalCode,
  country: Joi.string().trim().min(2).max(80).default('India'),
  isDefault: Joi.boolean().default(false),
});

export const addressUpdateSchema = addressSchema.fork(Object.keys(addressSchema.describe().keys), (schema) => schema.optional());
