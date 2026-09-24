import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { validate, validateQuery, validateObjectIdParam } from '../../middleware/validate.middleware.js';
import { adminController } from './controller.js';
import { shipmentController } from '../shipments/controller.js';
import { invoiceController } from '../invoices/controller.js';
import { listProductsQuerySchema } from '../products/validation.js';
import Joi from 'joi';

const router = express.Router();
const adminSettingsSchema = Joi.object({ value: Joi.any().required(), description: Joi.string().trim().max(200).optional().allow('') });
const adminUserStatusSchema = Joi.object({ isActive: Joi.boolean().required() });
const adminInventoryAdjustSchema = Joi.object({ delta: Joi.number().integer().invalid(0).min(-10000).max(10000).required(), reason: Joi.string().trim().max(200).optional().allow(''), referenceId: Joi.string().trim().max(120).optional().allow('') });
const adminPaginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
const adminProductsQuerySchema = listProductsQuerySchema.keys({
  status: Joi.string().valid('PUBLISHED', 'DRAFT', 'ARCHIVED').optional(),
});
const adminShipmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().trim().uppercase().optional().allow(''),
  provider: Joi.string().trim().lowercase().optional().allow(''),
  search: Joi.string().trim().max(100).optional().allow(''),
});

router.use(protect, isAdmin);

const adminSalesRangeSchema = Joi.object({
  range: Joi.string().valid('today', '7d', '30d', 'all').default('today'),
});

router.get('/dashboard', asyncHandler(adminController.dashboard));
router.get('/sales-overview', validateQuery(adminSalesRangeSchema), asyncHandler(adminController.salesOverview));
router.get('/products', validateQuery(adminProductsQuerySchema), asyncHandler(adminController.listProducts));
router.get('/users', validateQuery(adminPaginationSchema), asyncHandler(adminController.listUsers));
router.get('/users/:id', validateObjectIdParam('id'), asyncHandler(adminController.getUserById));
router.patch('/users/:id/status', validateObjectIdParam('id'), validate(adminUserStatusSchema), asyncHandler(adminController.updateUserStatus));
router.get('/inventory', validateQuery(Joi.object({ page: Joi.number().min(1).default(1), limit: Joi.number().min(1).max(100).default(20), lowStock: Joi.boolean().optional() })), asyncHandler(adminController.listInventory));
router.get('/inventory/low-stock', asyncHandler(adminController.getLowStockInventory));
router.get('/inventory/:variantId', validateObjectIdParam('variantId'), asyncHandler(adminController.getInventoryByVariant));
router.post('/inventory/:variantId/adjust', validateObjectIdParam('variantId'), validate(adminInventoryAdjustSchema), asyncHandler(adminController.adjustInventory));
router.get('/inventory/:variantId/movements', validateObjectIdParam('variantId'), validateQuery(adminPaginationSchema), asyncHandler(adminController.listInventoryMovements));
router.get('/settings', asyncHandler(adminController.listSettings));
router.patch('/settings/:key', validate(adminSettingsSchema), asyncHandler(adminController.updateSetting));
router.get('/audit-logs', validateQuery(adminPaginationSchema), asyncHandler(adminController.listAuditLogs));
router.post('/orders/:id/ship', validateObjectIdParam('id'), asyncHandler(shipmentController.create));
router.post('/shipments/orders/:id', validateObjectIdParam('id'), asyncHandler(shipmentController.create));
router.get('/shipments', validateQuery(adminShipmentsQuerySchema), asyncHandler(shipmentController.listAdmin));
router.get('/shipments/:id', validateObjectIdParam('id'), asyncHandler(shipmentController.getAdminDetails));
router.get('/orders/:id/invoice', validateObjectIdParam('id'), asyncHandler(invoiceController.getAdminInvoice));
router.post('/orders/:id/invoice/resend', validateObjectIdParam('id'), asyncHandler(invoiceController.resend));

export default router;
