import mongoose from 'mongoose';

// Temporary signup state. A normal active CUSTOMER user is NEVER created from
// this collection — it only becomes a User after OTP verification succeeds.
// Documents self-destruct via the expiresAt TTL index.
const registrationRequestSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    otpHash: { type: String, required: true, select: false },
    otpExpiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0, min: 0 },
    resendAvailableAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'consumed', 'expired'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

registrationRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
registrationRequestSchema.index({ email: 1, status: 1 });

const RegistrationRequest = mongoose.model('RegistrationRequest', registrationRequestSchema);

export default RegistrationRequest;
