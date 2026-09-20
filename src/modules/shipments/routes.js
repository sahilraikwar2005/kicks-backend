import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { shipmentController } from './controller.js';

const router = express.Router();

router.post('/webhook', asyncHandler(shipmentController.webhook));

export default router;
