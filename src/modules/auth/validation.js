import Joi from 'joi';

export const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).required(),
  lastName: Joi.string().trim().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
}).unknown(false);

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
}).unknown(false);

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().optional(),
}).unknown(false);

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
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
