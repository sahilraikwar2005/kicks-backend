import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gateway: { type: String, enum: ['RAZORPAY'], default: 'RAZORPAY' },
    gatewayOrderId: { type: String, default: '' },
    paymentId: { type: String, default: '' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
    refundId: { type: String, default: '' },
    refundAmount: { type: Number, default: 0 },
    refundStatus: { type: String, enum: ['NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'PROCESSED', 'FAILED'], default: 'NONE' },
    refundedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentSchema.index({ gatewayOrderId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ order: 1, status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
