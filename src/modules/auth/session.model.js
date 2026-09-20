import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  device: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('UserSession', sessionSchema);
