import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { blogController } from './controller.js';

const router = express.Router();
router.get('/admin/all', protect, isAdmin, asyncHandler(blogController.adminList));
router.get('/', asyncHandler(blogController.list));
router.get('/:slug', asyncHandler(blogController.get));
router.post('/', protect, isAdmin, asyncHandler(blogController.create));
router.patch('/:id', protect, isAdmin, asyncHandler(blogController.update));
export default router;
