import { apiClient } from './client';

export const cartApi = {
  getCart: () => apiClient.get('/cart').then((response) => response.data),
  addItem: (payload) => apiClient.post('/cart/items', payload).then((response) => response.data),
  updateItem: (variantId, quantity) =>
    apiClient.patch(`/cart/items/${variantId}`, { quantity }).then((response) => response.data),
  removeItem: (variantId) => apiClient.delete(`/cart/items/${variantId}`).then((response) => response.data),
  clearCart: () => apiClient.delete('/cart').then((response) => response.data),
};
