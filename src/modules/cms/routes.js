import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { cmsController } from './controller.js';

const router = express.Router();
router.get('/admin/all', protect, isAdmin, asyncHandler(cmsController.adminList));
router.get('/', asyncHandler(cmsController.publicList));
router.post('/', protect, isAdmin, asyncHandler(cmsController.create));
router.patch('/:id', protect, isAdmin, asyncHandler(cmsController.update));
export default router;
