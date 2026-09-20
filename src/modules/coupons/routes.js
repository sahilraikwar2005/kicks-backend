import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { couponService } from './service.js';
import { auditService } from '../audit/service.js';

const router = express.Router();

router.get('/validate', protect, asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.query;
  const result = await couponService.validateCoupon(code, req.user._id, Number(cartTotal || 0));
  res.status(200).json({ success: true, message: 'Coupon validated', data: result });
}));

router.post('/', protect, isAdmin, asyncHandler(async (req, res) => {
  const coupon = await couponService.create(req.body);
  await auditService.record({ actor: req.user._id, action: 'COUPON_CREATED', resource: 'coupon', resourceId: coupon._id, ip: req.ip });
  res.status(201).json({ success: true, message: 'Coupon created', data: { coupon } });
}));

export default router;
