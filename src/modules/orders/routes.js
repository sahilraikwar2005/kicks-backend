import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { orderController } from './controller.js';
import { shipmentController } from '../shipments/controller.js';
import { invoiceController } from '../invoices/controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { checkoutSchema } from './validation.js';

const router = express.Router();

router.get('/me', protect, asyncHandler(orderController.listForUser));
router.get('/me/:id', protect, asyncHandler(orderController.getById));
router.post('/me/:id/cancel', protect, asyncHandler(orderController.cancel));
router.get('/:id/tracking', protect, asyncHandler(shipmentController.tracking));
router.get('/:id/invoice', protect, asyncHandler(invoiceController.getCustomerInvoice));
router.post('/checkout', protect, validate(checkoutSchema), asyncHandler(orderController.checkout));
router.get('/', protect, isAdmin, asyncHandler(orderController.listAdmin));
router.patch('/:id/status', protect, isAdmin, asyncHandler(orderController.updateStatus));

export default router;
