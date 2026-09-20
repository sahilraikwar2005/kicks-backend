import { apiClient } from './client';

export const ordersApi = {
  checkout: (payload) => apiClient.post('/orders/checkout', payload).then((response) => response.data),
  listForUser: () => apiClient.get('/orders/me').then((response) => response.data),
  getById: (id) => apiClient.get(`/orders/me/${id}`).then((response) => response.data),
  cancel: (id) => apiClient.post(`/orders/me/${id}/cancel`).then((response) => response.data),
  track: (id) => apiClient.get(`/orders/${id}/tracking`).then((response) => response.data),
  invoice: (id) => apiClient.get(`/orders/${id}/invoice`, { responseType: 'blob' }).then((response) => response.data),
};
