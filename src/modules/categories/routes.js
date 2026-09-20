import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { categoryController } from './controller.js';

const router = express.Router();

router.get('/', asyncHandler(categoryController.list));
router.get('/:id', asyncHandler(categoryController.getById));
router.post('/', protect, isAdmin, asyncHandler(categoryController.create));
router.patch('/:id', protect, isAdmin, asyncHandler(categoryController.update));
router.delete('/:id', protect, isAdmin, asyncHandler(categoryController.remove));

export default router;
