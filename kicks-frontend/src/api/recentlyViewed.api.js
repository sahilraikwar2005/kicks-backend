import { apiClient } from './client';

export const recentlyViewedApi = {
  list: () => apiClient.get('/users/me/recently-viewed').then((response) => response.data),
  add: (productId) => apiClient.post(`/products/${productId}/view`).then((response) => response.data),
  clear: () => apiClient.delete('/users/me/recently-viewed').then((response) => response.data),
};
