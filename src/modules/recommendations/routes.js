import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { recommendationController } from './controller.js';

const router = express.Router();
router.get('/:slug/recommendations', asyncHandler(recommendationController.list));
export default router;
