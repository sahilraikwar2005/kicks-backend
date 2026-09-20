import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { addressController } from './controller.js';
import { addressSchema, addressUpdateSchema } from './validation.js';

const router = express.Router();
router.use(protect);
router.get('/', asyncHandler(addressController.list));
router.post('/', validate(addressSchema), asyncHandler(addressController.create));
router.get('/:id', asyncHandler(addressController.get));
router.patch('/:id', validate(addressUpdateSchema), asyncHandler(addressController.update));
router.delete('/:id', asyncHandler(addressController.remove));
router.patch('/:id/default', asyncHandler(addressController.setDefault));
export default router;
