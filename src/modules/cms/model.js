import mongoose from 'mongoose';

const cmsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  type: { type: String, enum: ['HERO', 'BANNER', 'PROMOTION', 'FEATURED'], required: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('CmsContent', cmsSchema);
