import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    provider: { type: String, enum: ['RAZORPAY'], default: 'RAZORPAY' },
    idempotencyKey: { type: String, required: true },
    gatewayRefundId: { type: String },
    gatewayPaymentId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING', index: true },
    reason: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    previousState: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

refundSchema.index({ payment: 1, idempotencyKey: 1 }, { unique: true });
refundSchema.index({ provider: 1, gatewayRefundId: 1 }, { unique: true, sparse: true });
refundSchema.index({ payment: 1, status: 1 });

const Refund = mongoose.model('Refund', refundSchema);

export default Refund;
