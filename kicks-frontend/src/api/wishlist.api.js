import { apiClient } from './client';

export const wishlistApi = {
  getWishlist: () => apiClient.get('/wishlist').then((response) => response.data),
  addToWishlist: (productId) => apiClient.post('/wishlist', { productId }).then((response) => response.data),
  removeFromWishlist: (productId) => apiClient.delete(`/wishlist/${productId}`).then((response) => response.data),
};
