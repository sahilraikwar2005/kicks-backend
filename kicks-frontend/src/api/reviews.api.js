import { apiClient } from './client';

export const reviewsApi = {
  list: (productId) => apiClient.get(`/products/${productId}/reviews`).then((response) => response.data),
  create: (productId, payload) => apiClient.post(`/products/${productId}/reviews`, payload).then((response) => response.data),
};
