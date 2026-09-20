import { apiClient } from './client';

export const authApi = {
  register: (payload) => apiClient.post('/auth/register', payload).then((response) => response.data),
  login: (payload) => apiClient.post('/auth/login', payload).then((response) => response.data),
  logout: () => apiClient.post('/auth/logout').then((response) => response.data),
  logoutAll: () => apiClient.post('/auth/logout-all').then((response) => response.data),
  refresh: (refreshToken) => apiClient.post('/auth/refresh', { refreshToken }).then((response) => response.data),
  me: () => apiClient.get('/auth/me').then((response) => response.data),
  forgotPassword: (payload) => apiClient.post('/auth/forgot-password', payload).then((response) => response.data),
  resetPassword: (payload) => apiClient.post('/auth/reset-password', payload).then((response) => response.data),
  changePassword: (payload) => apiClient.post('/auth/change-password', payload).then((response) => response.data),
  verifyEmail: (payload) => apiClient.post('/auth/verify-email', payload).then((response) => response.data),
  resendVerification: () => apiClient.post('/auth/resend-verification').then((response) => response.data),
};
