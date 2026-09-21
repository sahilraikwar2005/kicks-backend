import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate, validateQuery, validateObjectIdParam } from '../../middleware/validate.middleware.js';
import { optionalAuth, protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { productController } from './controller.js';
import { createProductSchema, listProductsQuerySchema } from './validation.js';
import reviewRoutes from '../reviews/routes.js';

const router = express.Router();

router.get('/', optionalAuth, validateQuery(listProductsQuerySchema), asyncHandler(productController.listProducts));
router.get('/featured', asyncHandler(productController.featured));
router.use('/:productId/reviews', reviewRoutes);
router.get('/:slug', optionalAuth, asyncHandler(productController.getProductBySlug));
router.post('/', protect, isAdmin, validate(createProductSchema), asyncHandler(productController.createProduct));
router.patch('/:id', protect, isAdmin, validateObjectIdParam('id'), asyncHandler(productController.updateProduct));
router.delete('/:id', protect, isAdmin, validateObjectIdParam('id'), asyncHandler(productController.deleteProduct));

export default router;
