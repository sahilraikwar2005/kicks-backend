import Joi from 'joi';

const emailRule = Joi.string().email({ tlds: false }).lowercase().required();

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().email({ tlds: false }).lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
  confirmPassword: Joi.string().optional(),
  captchaToken: Joi.string().min(10).max(4096).required(),
}).unknown(false);

export const verifyOtpSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(100).required(),
  code: Joi.string().trim().pattern(/^\d{6}$/).required(),
}).unknown(false);

export const resendOtpSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(100).required(),
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
