import mongoose from 'mongoose';

const paymentWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    gateway: { type: String, required: true, default: 'RAZORPAY', index: true },
    provider: { type: String, default: 'RAZORPAY', index: true },
    createdAt: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    updatedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED'], default: 'RECEIVED', index: true },
    payloadHash: { type: String, default: '', index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: false },
);

paymentWebhookEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true });

const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent', paymentWebhookEventSchema);

export default PaymentWebhookEvent;
