import { apiSuccess } from '../../utils/apiResponse.js';
import { authService } from './service.js';

export const authController = {
  register: async (req, res) => {
    const result = await authService.register(req.body);
    authService.setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.status(201).json(apiSuccess('Registration successful', { user: result.user }));
  },

  login: async (req, res) => {
    const result = await authService.login(req.body);
    authService.setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.status(200).json(apiSuccess('Login successful', { user: result.user }));
  },

  logout: async (req, res) => {
    await authService.logout(req.user._id);
    authService.clearAuthCookies(res);
    return res.status(200).json(apiSuccess('Logged out successfully', { ok: true }));
  },

  logoutAll: async (req, res) => {
    await authService.logoutAll(req.user._id);
    authService.clearAuthCookies(res);
    return res.status(200).json(apiSuccess('All sessions logged out', { ok: true }));
  },

  refresh: async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    const result = await authService.refresh(refreshToken);
    authService.setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.status(200).json(apiSuccess('Token refreshed', { ok: true }));
  },

  getCurrentUser: async (req, res) => {
    return res.status(200).json(apiSuccess('Current user fetched', { user: req.user }));
  },

  forgotPassword: async (req, res) => {
    await authService.forgotPassword(req.body.email);
    return res.status(200).json(apiSuccess('If the account exists, a password reset link was sent.', { ok: true }));
  },

  resetPassword: async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password);
    authService.clearAuthCookies(res);
    return res.status(200).json(apiSuccess('Password reset successfully', { ok: true }));
  },

  changePassword: async (req, res) => {
    await authService.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword);
    authService.clearAuthCookies(res);
    return res.status(200).json(apiSuccess('Password changed successfully', { ok: true }));
  },

  verifyEmail: async (req, res) => res.status(200).json(apiSuccess('Email verified', { user: await authService.verifyEmail(req.body.token) })),
  resendVerification: async (req, res) => { await authService.resendVerification(req.user._id); return res.status(200).json(apiSuccess('Verification email sent', { ok: true })); },
};
