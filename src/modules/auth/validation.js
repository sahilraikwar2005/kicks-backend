import Joi from 'joi';

const emailRule = Joi.string().email({ tlds: false }).lowercase().required();

export const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).required(),
  lastName: Joi.string().trim().min(2).required(),
  email: emailRule,
  password: Joi.string().min(8).required(),
}).unknown(false);

export const loginSchema = Joi.object({
  email: emailRule,
  password: Joi.string().required(),
}).unknown(false);

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().optional(),
}).unknown(false);

export const forgotPasswordSchema = Joi.object({
  email: emailRule,
}).unknown(false);

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
}).unknown(false);

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
}).unknown(false);

export const verificationSchema = Joi.object({ token: Joi.string().required() }).unknown(false);
