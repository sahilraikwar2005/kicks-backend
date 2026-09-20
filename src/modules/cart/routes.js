import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { cartController } from './controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { addCartItemSchema, updateCartItemSchema } from './validation.js';

const router = express.Router();

router.use(protect);
router.get('/', asyncHandler(cartController.getCart));
router.post('/items', validate(addCartItemSchema), asyncHandler(cartController.addItem));
router.patch('/items/:variantId', validate(updateCartItemSchema), asyncHandler(cartController.updateItem));
router.delete('/items/:variantId', asyncHandler(cartController.removeItem));
router.delete('/', asyncHandler(cartController.clearCart));

export default router;
