import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { reviewController } from './controller.js';

const router = express.Router({ mergeParams: true });
router.get('/', asyncHandler(reviewController.list));
router.post('/', protect, asyncHandler(reviewController.create));
export default router;
