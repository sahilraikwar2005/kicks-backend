import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { wishlistController } from './controller.js';

const router = express.Router();

router.use(protect);
router.get('/', asyncHandler(wishlistController.getWishlist));
router.post('/', asyncHandler(wishlistController.addToWishlist));
router.delete('/:productId', asyncHandler(wishlistController.removeFromWishlist));

export default router;
