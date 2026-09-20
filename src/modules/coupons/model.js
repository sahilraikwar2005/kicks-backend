import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
    value: { type: Number, required: true, min: 0 },
    minCartValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
    firstOrderOnly: { type: Boolean, default: false },
    productRestrictions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categoryRestrictions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    usedCount: { type: Number, default: 0 },
    userUsage: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
