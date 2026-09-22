import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimit.middleware.js';
import { protect } from '../../middleware/auth.middleware.js';
import { authController } from './controller.js';
import {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verificationSchema,
} from './validation.js';

const router = express.Router();

router.post('/register', authRateLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/register/verify-otp', authRateLimiter, validate(verifyOtpSchema), asyncHandler(authController.verifyRegistrationOtp));
router.post('/register/resend-otp', authRateLimiter, validate(resendOtpSchema), asyncHandler(authController.resendRegistrationOtp));
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/logout', protect, asyncHandler(authController.logout));
router.post('/logout-all', protect, asyncHandler(authController.logoutAll));
router.post('/refresh', validate(refreshSchema), asyncHandler(authController.refresh));
router.get('/me', protect, asyncHandler(authController.getCurrentUser));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(authController.resetPassword));
router.post('/change-password', protect, validate(changePasswordSchema), asyncHandler(authController.changePassword));
router.post('/verify-email', validate(verificationSchema), asyncHandler(authController.verifyEmail));
router.post('/resend-verification', protect, asyncHandler(authController.resendVerification));

export default router;
