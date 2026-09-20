import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { notificationController } from './controller.js';

const router = express.Router();
router.use(protect);
router.get('/', asyncHandler(notificationController.list));
router.patch('/:id/read', asyncHandler(notificationController.read));
export default router;
