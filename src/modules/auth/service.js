import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import User from '../users/model.js';
import { auditService } from '../audit/service.js';
import { env } from '../../config/env.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import UserSession from './session.model.js';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
} from '../../services/email.service.js';

const tokenCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production' || env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/',
};

const sanitizeUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  emailVerified: user.emailVerified,
  avatar: user.avatar,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    ...tokenCookieOptions,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', refreshToken, {
    ...tokenCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', tokenCookieOptions);
  res.clearCookie('refreshToken', tokenCookieOptions);
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const createSession = (userId, refreshToken) => UserSession.create({
  user: userId,
  tokenHash: hashToken(refreshToken),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

export const authService = {
  async register(payload) {
    const existing = await User.findOne({ email: payload.email.toLowerCase() });
    if (existing) {
      const error = new Error('User already exists');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await User.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email.toLowerCase(),
      password: passwordHash,
      role: 'CUSTOMER',
    });

    const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
    const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role });

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = hashToken(verificationToken);
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    await createSession(user._id, refreshToken);

    try {
      await sendWelcomeEmail(user);
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error('Failed to send welcome email:', error.message);
      }
    }

    if (user.verificationToken) {
      try {
        await sendVerificationEmail(user, `${env.clientUrl}/verify-email?token=${verificationToken}`);
      } catch (error) {
        if (error.statusCode !== 503) {
          console.error('Failed to send verification email:', error.message);
        }
      }
    }
    return { user: sanitizeUser(user), accessToken, refreshToken };
  },

  async login(payload) {
    const user = await User.findOne({ email: payload.email.toLowerCase() }).select('+password');
    if (!user || !user.isActive) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isValid = await bcrypt.compare(payload.password, user.password);
    if (!isValid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
    const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role });
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    user.lastLoginAt = new Date();
    await user.save();
    await UserSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await createSession(user._id, refreshToken);
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      await auditService.record({ actor: user._id, action: 'ADMIN_LOGIN', resource: 'user', resourceId: user._id });
    }

    return { user: sanitizeUser(user), accessToken, refreshToken };
  },

  async refresh(refreshToken) {
    if (!refreshToken) {
      const error = new Error('Refresh token required');
      error.statusCode = 401;
      throw error;
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.sub).select('+password');
    if (!user || !user.isActive) {
      const error = new Error('Session expired');
      error.statusCode = 401;
      throw error;
    }

    if (decoded.role && decoded.role !== user.role) {
      const error = new Error('Refresh token role mismatch');
      error.statusCode = 401;
      throw error;
    }

    const session = await UserSession.findOne({ user: user._id, tokenHash: hashToken(refreshToken), revokedAt: null, expiresAt: { $gt: new Date() } });
    if (!session || !user.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
      const error = new Error('Refresh token reuse detected');
      error.statusCode = 401;
      throw error;
    }

    const newAccessToken = signAccessToken({ sub: String(user._id), role: user.role });
    const newRefreshToken = signRefreshToken({ sub: String(user._id), role: user.role });
    user.refreshTokenHash = await bcrypt.hash(newRefreshToken, 12);
    await user.save();
    session.revokedAt = new Date();
    await session.save();
    await createSession(user._id, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(userId) {
    const user = await User.findById(userId);
    if (user) {
      user.refreshTokenHash = '';
      await user.save();
    }
    await UserSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    return true;
  },

  async logoutAll(userId) {
    await UserSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await User.updateOne({ _id: userId }, { $set: { refreshTokenHash: '' } });
    return true;
  },

  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return { message: 'If the account exists, a password reset link was sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    try {
      await sendPasswordResetEmail(user, `${env.clientUrl}/reset-password?token=${resetToken}`);
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error('Failed to send password reset email:', error.message);
      }
    }
    return { message: 'If the account exists, a password reset link was sent.' };
  },

  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      const error = new Error('Reset token is invalid or expired');
      error.statusCode = 400;
      throw error;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = '';
    user.resetPasswordExpires = null;
    await user.save();
    await this.logoutAll(user._id);

    try {
      await sendPasswordChangedEmail(user);
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error('Failed to send password changed email:', error.message);
      }
    }

    return true;
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 400;
      throw error;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.refreshTokenHash = '';
    await user.save();
    await UserSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

    try {
      await sendPasswordChangedEmail(user);
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error('Failed to send password changed email:', error.message);
      }
    }

    return true;
  },

  async verifyEmail(token) {
    const user = await User.findOne({ verificationToken: hashToken(token), verificationTokenExpires: { $gt: new Date() } });
    if (!user) { const error = new Error('Verification token is invalid or expired'); error.statusCode = 400; throw error; }
    user.emailVerified = true;
    user.verificationToken = '';
    user.verificationTokenExpires = null;
    await user.save();
    return sanitizeUser(user);
  },

  async resendVerification(userId) {
    const user = await User.findById(userId);
    if (!user) { const error = new Error('User not found'); error.statusCode = 404; throw error; }
    const token = crypto.randomBytes(32).toString('hex');
    user.verificationToken = hashToken(token);
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    try {
      await sendVerificationEmail(user, `${env.clientUrl}/verify-email?token=${token}`);
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error('Failed to resend verification email:', error.message);
      }
    }
    return true;
  },

  setAuthCookies,
  clearAuthCookies,
};
