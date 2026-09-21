import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { aiController } from './controller.js';
import { analyzeProductSchema } from './validation.js';

const router = express.Router();

router.post(
  '/product-analyze',
  protect,
  isAdmin,
  aiRateLimiter,
  validate(analyzeProductSchema),
  asyncHandler(aiController.analyzeProduct),
);

export default router;
