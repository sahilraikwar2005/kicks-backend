import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { orderController } from './controller.js';
import { shipmentController } from '../shipments/controller.js';
import { invoiceController } from '../invoices/controller.js';
import { validate, validateQuery, validateObjectIdParam } from '../../middleware/validate.middleware.js';
import { checkoutSchema } from './validation.js';
import Joi from 'joi';

const adminOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().trim().uppercase().optional().allow(''),
  search: Joi.string().trim().max(100).optional().allow(''),
});

const router = express.Router();

router.get('/me', protect, asyncHandler(orderController.listForUser));
router.get('/me/:id', protect, validateObjectIdParam('id'), asyncHandler(orderController.getById));
router.post('/me/:id/cancel', protect, validateObjectIdParam('id'), asyncHandler(orderController.cancel));
router.get('/:id/tracking', protect, validateObjectIdParam('id'), asyncHandler(shipmentController.tracking));
router.get('/:id/invoice', protect, validateObjectIdParam('id'), asyncHandler(invoiceController.getCustomerInvoice));
router.post('/checkout', protect, validate(checkoutSchema), asyncHandler(orderController.checkout));
router.get('/', protect, isAdmin, validateQuery(adminOrdersQuerySchema), asyncHandler(orderController.listAdmin));
router.patch('/:id/status', protect, isAdmin, validateObjectIdParam('id'), asyncHandler(orderController.updateStatus));

export default router;
