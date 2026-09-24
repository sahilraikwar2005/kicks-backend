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
    enum: ['PENDING', 'PROCESSING', 'CREATED', 'AWB_ASSIGNED', 'READY_FOR_PICKUP', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NDR', 'RTO_INITIATED', 'RTO_IN_TRANSIT', 'RETURNED', 'CANCELLED', 'FAILED', 'SHIPPED'],
    default: 'PENDING',
    index: true,
  },
  // True only for clearly-fake provider records (MOCK). Real courier
  // shipments always store false here.
  isTest: { type: Boolean, default: false, index: true },
  // Printable test label (HTML). Populated by the mock provider only.
  labelHtml: { type: String, default: '' },
  pickup: {
    requestId: { type: String, default: '' },
    status: { type: String, default: '' },
    date: { type: Date, default: null },
    slot: { type: String, default: '' },
  },
  estimatedDeliveryDate: { type: Date, default: null },
  events: [shipmentEventSchema],
  failureReason: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  raw: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

shipmentSchema.index({ provider: 1, shipmentId: 1 }, { sparse: true });
shipmentSchema.index({ provider: 1, awb: 1 }, { sparse: true });

export default mongoose.model('Shipment', shipmentSchema);
