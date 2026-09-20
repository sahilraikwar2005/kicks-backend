import mongoose from 'mongoose';

const shipmentEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    occurredAt: { type: Date, default: Date.now },
    providerReference: { type: String, default: '' },
    source: { type: String, default: 'system' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  provider: { type: String, required: true },
  shipmentId: { type: String, default: '' },
  awb: { type: String, default: '' },
  trackingUrl: { type: String, default: '' },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'CREATED', 'AWB_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED', 'SHIPPED'],
    default: 'PENDING',
    index: true,
  },
  events: [shipmentEventSchema],
  failureReason: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  raw: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

shipmentSchema.index({ provider: 1, shipmentId: 1 }, { sparse: true });
shipmentSchema.index({ provider: 1, awb: 1 }, { sparse: true });

export default mongoose.model('Shipment', shipmentSchema);
