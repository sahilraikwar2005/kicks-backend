import mongoose from 'mongoose';

const shipmentWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, index: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    payloadHash: { type: String, required: true },
    status: { type: String, enum: ['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED'], default: 'RECEIVED', index: true },
    attempts: { type: Number, default: 0 },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    lastError: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

shipmentWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const ShipmentWebhookEvent = mongoose.model('ShipmentWebhookEvent', shipmentWebhookEventSchema);

export default ShipmentWebhookEvent;
