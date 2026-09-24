import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import User from '../users/model.js';
import PasswordResetRequest from './passwordReset.model.js';
import { authService } from './service.js';
import { generateOtp, hashOtp, maskEmail, normalizeEmail, safeEqualHex } from './registration.service.js';
import { sendPasswordChangedEmail, sendPasswordResetOtpEmail } from '../../services/email.service.js';

// Email-OTP password reset: email -> 6-digit OTP -> server-issued one-time
// reset challenge -> new password. The raw OTP is never stored (HMAC hash
// only) and never returned; the raw reset challenge is returned exactly once
// at OTP verification and is single-use with a short TTL. All sessions are
// revoked on successful reset via the established logoutAll mechanism.
export const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;
export const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_DOC_TTL_MS = 30 * 60 * 1000;

function resetError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const GENERIC_MESSAGE = 'If an account exists for this email, a verification code has been sent.';

function uniformPayload(email) {
  return {
    identifier: maskEmail(email),
    expiresInSeconds: Math.floor(PASSWORD_RESET_OTP_TTL_MS / 1000),
    resendAfterSeconds: Math.ceil(PASSWORD_RESET_RESEND_COOLDOWN_MS / 1000),
  };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function findActivePending(email) {
  return PasswordResetRequest.findOne({
    email,
    status: 'pending',
    otpExpiresAt: { $gt: new Date() },
  }).select('+otpHash');
}

export const passwordResetService = {
  async requestReset({ email }) {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select('_id firstName isActive');
    if (!user || !user.isActive) {
      // Unknown/inactive address: identical shape, no document, no email.
      return { ...uniformPayload(normalizedEmail), message: GENERIC_MESSAGE };
    }

    const now = new Date();
    const inFlight = await PasswordResetRequest.findOne({
      email: normalizedEmail,
      status: 'pending',
      otpExpiresAt: { $gt: now },
    }).select('_id resendAvailableAt');
    if (inFlight && inFlight.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((inFlight.resendAvailableAt - now) / 1000);
      throw resetError(`Resend available in ${waitSeconds} seconds.`, 429);
    }

    const otp = generateOtp();
    await PasswordResetRequest.deleteMany({ email: normalizedEmail, status: { $in: ['pending', 'verified'] } });
    await PasswordResetRequest.create({
      email: normalizedEmail,
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS),
      attempts: 0,
      resendAvailableAt: new Date(now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS),
      status: 'pending',
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_DOC_TTL_MS),
    });

    try {
      await sendPasswordResetOtpEmail({ to: normalizedEmail, firstName: user.firstName, otp });
    } catch (error) {
      throw resetError(error?.message || 'Verification code could not be sent. Please try again.', error?.statusCode || 503);
    }

    return { ...uniformPayload(normalizedEmail), message: GENERIC_MESSAGE };
  },

  async verifyOtp({ email, code }) {
    const normalizedEmail = normalizeEmail(email);
    const digits = String(code || '').replace(/\D/g, '');
    if (digits.length !== 6) {
      throw resetError('Enter the 6-digit verification code.', 400);
    }

    const pending = await findActivePending(normalizedEmail);
    if (!pending) {
      throw resetError('Verification code is invalid or expired.', 400);
    }
    if (pending.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      throw resetError('Too many attempts. Request a new code.', 429);
    }
    if (!safeEqualHex(hashOtp(digits), pending.otpHash)) {
      pending.attempts += 1;
      await pending.save();
      throw resetError('Incorrect verification code.', 400);
    }

    // OTP correct: consume it atomically and issue a single-use challenge.
    const resetToken = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const claimed = await PasswordResetRequest.findOneAndUpdate(
      { _id: pending._id, status: 'pending' },
      {
        $set: {
          status: 'verified',
          otpHash: 'consumed',
          resetTokenHash: hashResetToken(resetToken),
          resetTokenExpiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      },
      { new: true },
    );
    if (!claimed) {
      throw resetError('Verification code has already been used.', 409);
    }

    return {
      resetToken,
      identifier: maskEmail(normalizedEmail),
      resetExpiresInSeconds: Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 1000),
    };
  },

  async resendOtp({ email }) {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select('_id firstName isActive');
    if (!user || !user.isActive) {
      return { ...uniformPayload(normalizedEmail), message: GENERIC_MESSAGE };
    }

    const pending = await PasswordResetRequest.findOne({
      email: normalizedEmail,
      status: 'pending',
    });
    if (!pending || pending.otpExpiresAt <= new Date()) {
      throw resetError('No active reset request found. Please start again.', 400);
    }
    const now = new Date();
    if (pending.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((pending.resendAvailableAt - now) / 1000);
      throw resetError(`Resend available in ${waitSeconds} seconds.`, 429);
    }

    const otp = generateOtp();
    pending.otpHash = hashOtp(otp);
    pending.otpExpiresAt = new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS);
    pending.attempts = 0;
    pending.resendAvailableAt = new Date(now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS);
    pending.expiresAt = new Date(now.getTime() + PASSWORD_RESET_DOC_TTL_MS);
    await pending.save();

    try {
      await sendPasswordResetOtpEmail({ to: normalizedEmail, firstName: user.firstName, otp });
    } catch (error) {
      throw resetError(error?.message || 'Verification code could not be sent. Please try again.', error?.statusCode || 503);
    }

    return { ...uniformPayload(normalizedEmail), message: GENERIC_MESSAGE };
  },

  async confirmReset({ email, resetToken, newPassword, confirmPassword }) {
    const normalizedEmail = normalizeEmail(email);
    if (!newPassword || String(newPassword).length < 8) {
      throw resetError('Password must be at least 8 characters.', 400);
    }
    if (confirmPassword !== undefined && String(confirmPassword) !== String(newPassword)) {
      throw resetError('Passwords do not match.', 400);
    }
    if (!resetToken) {
      throw resetError('Reset session is invalid or expired.', 400);
    }

    const claimed = await PasswordResetRequest.findOne({
      email: normalizedEmail,
      status: 'verified',
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash');
    if (!claimed || !safeEqualHex(hashResetToken(resetToken), claimed.resetTokenHash)) {
      throw resetError('Reset session is invalid or expired.', 400);
    }

    // Single-use: second use finds status != verified and fails.
    const consumed = await PasswordResetRequest.findOneAndUpdate(
      { _id: claimed._id, status: 'verified' },
      { $set: { status: 'consumed', otpHash: 'consumed', resetTokenHash: 'consumed', resetTokenExpiresAt: null } },
      { new: true },
    );
    if (!consumed) {
      throw resetError('Reset session has already been used.', 409);
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.isActive) {
      throw resetError('Reset session is invalid or expired.', 400);
    }
    user.password = await bcrypt.hash(String(newPassword), 12);
    await user.save();
    await authService.logoutAll(user._id);

    try {
      await sendPasswordChangedEmail(user);
    } catch (error) {
      if (error?.statusCode !== 503) console.error('Failed to send password changed email:', error?.message);
    }

    return true;
  },
};
