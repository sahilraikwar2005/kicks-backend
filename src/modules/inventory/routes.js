import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { validate, validateQuery } from '../../middleware/validate.middleware.js';
import { inventoryController } from './controller.js';
import { inventoryAdjustSchema, inventoryQuerySchema } from './validation.js';

const router = express.Router();

router.use(protect, isAdmin);
router.get('/', validateQuery(inventoryQuerySchema), asyncHandler(inventoryController.list));
router.get('/low-stock', asyncHandler(inventoryController.lowStock));
router.get('/:variantId', asyncHandler(inventoryController.getByVariant));
router.post('/:variantId/adjust', validate(inventoryAdjustSchema), asyncHandler(inventoryController.adjust));
router.get('/:variantId/movements', validateQuery(inventoryQuerySchema), asyncHandler(inventoryController.movements));

export default router;
