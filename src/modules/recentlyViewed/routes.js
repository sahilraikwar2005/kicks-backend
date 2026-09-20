import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { recentlyViewedController } from './controller.js';

const router = express.Router();
router.use(protect);
router.post('/products/:id/view', asyncHandler(recentlyViewedController.add));
router.get('/users/me/recently-viewed', asyncHandler(recentlyViewedController.list));
router.delete('/users/me/recently-viewed', asyncHandler(recentlyViewedController.clear));
export default router;
