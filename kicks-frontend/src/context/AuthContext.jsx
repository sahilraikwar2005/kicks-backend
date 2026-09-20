import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { AuthContext } from './authContextValue';

/**
 * Silently attempt a cookie-based token refresh.
 * The backend reads the refreshToken from req.cookies automatically —
 * no request body is required. Returns true if new tokens were issued.
 */
async function tryTokenRefresh() {
  try {
    await apiClient.post('/auth/refresh', {});
    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      const payload = response?.data;
      const nextUser = payload?.data?.user || payload?.user || null;
      setUser(nextUser);
      return nextUser;
    } catch (err) {
      // Access token missing or expired — try a silent cookie-based refresh
      // before giving up, so users with a valid refresh token stay logged in.
      if (err?.status === 401) {
        const refreshed = await tryTokenRefresh();
        if (refreshed) {
          try {
            const retryResponse = await apiClient.get('/auth/me');
            const retryPayload = retryResponse?.data;
            const nextUser = retryPayload?.data?.user || retryPayload?.user || null;
            setUser(nextUser);
            return nextUser;
          } catch {
            // Refresh token also invalid or expired — fall through to clear state.
          }
        }
      }
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        await refreshUser();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    const payload = response.data;
    const nextUser = payload?.data?.user || payload?.user || null;
    setUser(nextUser);
    return payload;
  };

  const register = async (payload) => {
    const response = await apiClient.post('/auth/register', payload);
    const nextUser = response?.data?.data?.user || response?.data?.user || null;
    setUser(nextUser);
    return response.data;
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Swallow network errors — always clear local state.
    }
    setUser(null);
  };

  const forgotPassword = async (payload) => apiClient.post('/auth/forgot-password', payload);
  const resetPassword = async (payload) => apiClient.post('/auth/reset-password', payload);
  const verifyEmail = async (payload) => apiClient.post('/auth/verify-email', payload);
  const resendVerification = async () => apiClient.post('/auth/resend-verification');

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      forgotPassword,
      resetPassword,
      verifyEmail,
      resendVerification,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
