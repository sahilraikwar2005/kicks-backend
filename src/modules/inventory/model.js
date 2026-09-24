import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variant: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    availableStock: { type: Number, default: 0, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    soldStock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true },
);

inventorySchema.index({ product: 1, variant: 1 }, { unique: true });

const inventoryMovementSchema = new mongoose.Schema(
  {
    inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variant: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: {
      type: String,
      enum: ['RESTOCK', 'RESERVATION', 'RELEASE', 'SALE', 'REFUND', 'ADJUSTMENT'],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    referenceId: { type: String, default: '' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    paymentId: { type: String, default: '' },
    reason: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

inventoryMovementSchema.index({ type: 1, createdAt: -1 });

const Inventory = mongoose.model('Inventory', inventorySchema);
const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);

export { Inventory, InventoryMovement };
export default Inventory;
