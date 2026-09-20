import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { AuthContext } from './authContextValue';

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
    } catch {
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
    await apiClient.post('/auth/logout');
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
