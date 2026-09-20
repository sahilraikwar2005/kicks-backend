import { apiClient } from './client';

export const addressesApi = {
  list: () => apiClient.get('/addresses').then((response) => response.data),
  get: (id) => apiClient.get(`/addresses/${id}`).then((response) => response.data),
  create: (payload) => apiClient.post('/addresses', payload).then((response) => response.data),
  update: (id, payload) => apiClient.patch(`/addresses/${id}`, payload).then((response) => response.data),
  remove: (id) => apiClient.delete(`/addresses/${id}`).then((response) => response.data),
  setDefault: (id) => apiClient.patch(`/addresses/${id}/default`).then((response) => response.data),
};
