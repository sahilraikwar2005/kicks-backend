import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { paymentController } from './controller.js';

const router = express.Router();

router.post('/webhook', asyncHandler(paymentController.webhook));
router.use(protect);
router.post('/orders/:orderId', asyncHandler(paymentController.createOrder));
router.post('/verify', asyncHandler(paymentController.verify));

export default router;
