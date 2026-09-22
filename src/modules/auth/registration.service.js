import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import User from '../users/model.js';
import UserSession from './session.model.js';
import RegistrationRequest from './registration.model.js';
import { env } from '../../config/env.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { verifyCaptchaToken } from '../../services/captcha.service.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../services/email.service.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const PENDING_TTL_MS = 30 * 60 * 1000;

function registrationError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw registrationError('Enter a valid email address.', 400);
  }
  return normalized;
}

export function splitFullName(value) {
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens[0].length < 2) {
    throw registrationError('Enter your full name (at least 2 characters).', 400);
  }
  return { firstName: tokens[0], lastName: tokens.slice(1).join(' ') || tokens[0] };
}

export function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtp(otp) {
  const pepper = String(process.env.SESSION_SECRET || env.sessionSecret || 'kicks-otp-pepper');
  return crypto.createHmac('sha256', pepper).update(String(otp)).digest('hex');
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

export function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return '•••';
  return `${local.charAt(0) || '•'}***@${domain}`;
}

function sanitizeRegisteredUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email || undefined,
    phone: user.phone || undefined,
    role: user.role,
    emailVerified: user.emailVerified,
    avatar: user.avatar,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function issueLoginSession(user) {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role });
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
  await user.save();
  await UserSession.create({
    user: user._id,
    tokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return { accessToken, refreshToken };
}

async function findActivePending(email) {
  return RegistrationRequest.findOne({
    email,
    status: 'pending',
    otpExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +otpHash');
}

export const registrationService = {
  async startRegistration({ name, email, password, confirmPassword, captchaToken }, requestIp) {
    const { firstName, lastName } = splitFullName(name);
    if (!password || String(password).length < 8) {
      throw registrationError('Password must be at least 8 characters.', 400);
    }
    if (confirmPassword !== undefined && String(confirmPassword) !== String(password)) {
      throw registrationError('Passwords do not match.', 400);
    }
    const normalizedEmail = normalizeEmail(email);

    const verifiedExists = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (verifiedExists) {
      throw registrationError('An account with this email already exists.', 409);
    }

    await verifyCaptchaToken(captchaToken, requestIp);

    const now = new Date();
    const otp = generateOtp();
    const passwordHash = await bcrypt.hash(String(password), 12);
    const base = {
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash,
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
      attempts: 0,
      resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      status: 'pending',
      expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
    };

    const existing = await RegistrationRequest.findOne({
      email: normalizedEmail,
      status: 'pending',
      otpExpiresAt: { $gt: now },
    });
    let pending = null;
    if (existing) {
      Object.assign(existing, base);
      pending = await existing.save();
    } else {
      await RegistrationRequest.deleteMany({ email: normalizedEmail, status: 'pending' });
      pending = await RegistrationRequest.create(base);
    }

    try {
      await sendOtpEmail({ to: pending.email, firstName: pending.firstName, otp });
    } catch (error) {
      throw registrationError(error?.message || 'Verification code could not be sent. Please try again.', error?.statusCode || 503);
    }

    return {
      identifier: maskEmail(normalizedEmail),
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      resendAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    };
  },

  async verifyOtp({ identifier, code }) {
    const normalizedEmail = normalizeEmail(identifier);
    const digits = String(code || '').replace(/\D/g, '');
    if (digits.length !== 6) {
      throw registrationError('Enter the 6-digit verification code.', 400);
    }

    const pending = await findActivePending(normalizedEmail);
    if (!pending) {
      throw registrationError('Verification code is invalid or expired.', 400);
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      throw registrationError('Too many attempts. Request a new code.', 429);
    }
    if (!safeEqualHex(hashOtp(digits), pending.otpHash)) {
      pending.attempts += 1;
      await pending.save();
      throw registrationError('Incorrect verification code.', 400);
    }

    const consumed = await RegistrationRequest.findOneAndUpdate(
      { _id: pending._id, status: 'pending' },
      { $set: { status: 'verified', otpHash: 'consumed' } },
      { new: true },
    ).select('+passwordHash');
    if (!consumed) {
      throw registrationError('Verification code has already been used.', 409);
    }

    const duplicate = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (duplicate) {
      throw registrationError('An account with these details already exists.', 409);
    }

    try {
      const user = await User.create({
        firstName: consumed.firstName,
        lastName: consumed.lastName,
        email: normalizedEmail,
        emailVerified: true,
        password: consumed.passwordHash,
        role: 'CUSTOMER',
      });
      consumed.status = 'consumed';
      await consumed.save();
      const { accessToken, refreshToken } = await issueLoginSession(user);
      try {
        await sendWelcomeEmail(user);
      } catch (error) {
        if (error?.statusCode !== 503) console.error('Failed to send welcome email:', error?.message);
      }
      return { user: sanitizeRegisteredUser(user), accessToken, refreshToken };
    } catch (error) {
      if (error?.code === 11000) {
        throw registrationError('An account with these details already exists.', 409);
      }
      throw error;
    }
  },

  async resendOtp({ identifier }) {
    const normalizedEmail = normalizeEmail(identifier);
    const pending = await RegistrationRequest.findOne({
      email: normalizedEmail,
      status: 'pending',
    }).select('+passwordHash');
    if (!pending || pending.otpExpiresAt <= new Date()) {
      throw registrationError('No pending verification found. Please register again.', 400);
    }
    const now = new Date();
    if (pending.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((pending.resendAvailableAt - now) / 1000);
      const error = registrationError(`Resend available in ${waitSeconds} seconds.`, 429);
      error.resendAfterSeconds = waitSeconds;
      throw error;
    }

    const otp = generateOtp();
    pending.otpHash = hashOtp(otp);
    pending.otpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
    pending.attempts = 0;
    pending.resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);
    pending.expiresAt = new Date(now.getTime() + PENDING_TTL_MS);
    await pending.save();

    try {
      await sendOtpEmail({ to: pending.email, firstName: pending.firstName, otp });
    } catch (error) {
      throw registrationError(error?.message || 'Verification code could not be sent. Please try again.', error?.statusCode || 503);
    }

    return {
      identifier: maskEmail(normalizedEmail),
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      resendAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    };
  },
};
