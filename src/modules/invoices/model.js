import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  invoiceNumber: { type: String, required: true, unique: true },
  filePath: { type: String, required: true },
  invoiceDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['GENERATED', 'SENT'], default: 'GENERATED' },
}, { timestamps: true });

export default mongoose.model('Invoice', invoiceSchema);
