import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { brandController } from './controller.js';

const router = express.Router();

router.get('/', asyncHandler(brandController.list));
router.get('/:id', asyncHandler(brandController.getById));
router.post('/', protect, isAdmin, asyncHandler(brandController.create));
router.patch('/:id', protect, isAdmin, asyncHandler(brandController.update));
router.delete('/:id', protect, isAdmin, asyncHandler(brandController.remove));

export default router;
