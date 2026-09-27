import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  timeout: 20000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error?.response?.data;
    const message = payload?.message || error?.message || 'Request failed';
    const normalizedError = new Error(message);
    normalizedError.status = error?.response?.status;
    normalizedError.errors = Array.isArray(payload?.errors) ? payload.errors : [];
    normalizedError.requestId = payload?.requestId;
    return Promise.reject(normalizedError);
  },
);
