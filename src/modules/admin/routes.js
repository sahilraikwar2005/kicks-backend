import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { validate, validateQuery } from '../../middleware/validate.middleware.js';
import { adminController } from './controller.js';
import { adminAiGenerateSchema } from './validation.js';
import { shipmentController } from '../shipments/controller.js';
import { invoiceController } from '../invoices/controller.js';
import { reviewController } from '../reviews/controller.js';
import { refundController } from '../payments/refund.controller.js';
import { listProductsQuerySchema } from '../products/validation.js';
import Joi from 'joi';

const router = express.Router();
const adminSettingsSchema = Joi.object({ value: Joi.any().required(), description: Joi.string().trim().max(200).optional().allow('') });
const adminUserStatusSchema = Joi.object({ isActive: Joi.boolean().required() });
const adminInventoryAdjustSchema = Joi.object({ delta: Joi.number().required(), reason: Joi.string().trim().max(200).optional().allow(''), referenceId: Joi.string().trim().max(120).optional().allow('') });
const adminRefundSchema = Joi.object({
  amount: Joi.number().positive().optional(),
  reason: Joi.string().trim().max(300).optional().allow(''),
  idempotencyKey: Joi.string().trim().max(120).optional().allow(''),
});
const adminProductsQuerySchema = listProductsQuerySchema.keys({
  status: Joi.string().valid('PUBLISHED', 'DRAFT', 'ARCHIVED').optional(),
});

router.use(protect, isAdmin);

router.get('/dashboard', asyncHandler(adminController.dashboard));
router.get('/products', validateQuery(adminProductsQuerySchema), asyncHandler(adminController.listProducts));
router.get('/users', asyncHandler(adminController.listUsers));
router.get('/users/:id', asyncHandler(adminController.getUserById));
router.patch('/users/:id/status', validate(adminUserStatusSchema), asyncHandler(adminController.updateUserStatus));
router.get('/inventory', validateQuery(Joi.object({ page: Joi.number().min(1).default(1), limit: Joi.number().min(1).max(100).default(20), lowStock: Joi.boolean().optional() })), asyncHandler(adminController.listInventory));
router.get('/inventory/low-stock', asyncHandler(adminController.getLowStockInventory));
router.get('/inventory/:variantId', asyncHandler(adminController.getInventoryByVariant));
router.post('/inventory/:variantId/adjust', validate(adminInventoryAdjustSchema), asyncHandler(adminController.adjustInventory));
router.get('/inventory/:variantId/movements', asyncHandler(adminController.listInventoryMovements));
router.get('/settings', asyncHandler(adminController.listSettings));
router.patch('/settings/:key', validate(adminSettingsSchema), asyncHandler(adminController.updateSetting));
router.get('/audit-logs', asyncHandler(adminController.listAuditLogs));
router.get('/notifications', asyncHandler(adminController.listNotifications));
router.patch('/notifications/:id', asyncHandler(adminController.updateNotification));
router.post('/ai/product-generate', validate(adminAiGenerateSchema), asyncHandler(adminController.generateAiProduct));
router.post('/ai/product-regenerate', validate(adminAiGenerateSchema), asyncHandler(adminController.regenerateAiProduct));
router.post('/ai/product-description', validate(adminAiGenerateSchema), asyncHandler((req, res) => adminController.regenerateAiField({ ...req, params: { ...req.params, field: 'description' } }, res)));
router.post('/ai/product-seo', validate(adminAiGenerateSchema), asyncHandler((req, res) => adminController.regenerateAiField({ ...req, params: { ...req.params, field: 'seoDescription' } }, res)));
router.post('/orders/:id/ship', asyncHandler(shipmentController.create));
router.get('/orders/:id/invoice', asyncHandler(invoiceController.getAdminInvoice));
router.post('/orders/:id/invoice/resend', asyncHandler(invoiceController.resend));
router.post('/orders/:id/refund', validate(adminRefundSchema), asyncHandler(refundController.refund));
router.get('/reviews', asyncHandler(reviewController.listAdmin));
router.patch('/reviews/:id/approve', asyncHandler(reviewController.approve));
router.patch('/reviews/:id/reject', asyncHandler(reviewController.reject));

export default router;
