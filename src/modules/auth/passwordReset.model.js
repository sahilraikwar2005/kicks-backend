import mongoose from 'mongoose';

// Short-lived password-reset state for the EMAIL OTP flow. The raw OTP and
// the raw reset challenge are NEVER persisted — only their hashes. Documents
// self-destruct via the expiresAt TTL index. This collection is independent
// of the legacy link-based reset fields on User (resetPasswordToken), which
// remain untouched for in-flight legacy links.
const passwordResetRequestSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true, select: false },
    otpExpiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0, min: 0 },
    resendAvailableAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'consumed'],
      default: 'pending',
      index: true,
    },
    resetTokenHash: { type: String, default: '', select: false },
    resetTokenExpiresAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

passwordResetRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetRequestSchema.index({ email: 1, status: 1 });

const PasswordResetRequest = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);

export default PasswordResetRequest;
