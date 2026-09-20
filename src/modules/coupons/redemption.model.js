import mongoose from 'mongoose';

const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    discount: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'REDEEMED', 'RELEASED', 'FAILED'], default: 'PENDING', index: true },
    redeemedAt: { type: Date },
    releasedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

couponRedemptionSchema.index({ coupon: 1, order: 1 }, { unique: true });
couponRedemptionSchema.index({ coupon: 1, user: 1, order: 1 }, { unique: true });
couponRedemptionSchema.index({ coupon: 1, user: 1, status: 1 });

const CouponRedemption = mongoose.model('CouponRedemption', couponRedemptionSchema);

export default CouponRedemption;
