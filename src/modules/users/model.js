import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'],
      default: 'CUSTOMER',
      index: true,
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    avatar: { type: String, default: '' },
    refreshTokenHash: { type: String, default: '' },
    resetPasswordToken: { type: String, default: '' },
    resetPasswordExpires: { type: Date },
    verificationToken: { type: String, default: '' },
    verificationTokenExpires: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

const User = mongoose.model('User', userSchema);

export default User;
