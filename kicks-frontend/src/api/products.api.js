import { apiClient } from './client';

export const productsApi = {
  getFeatured: () => apiClient.get('/products/featured').then((res) => res.data),
  getList: (params = {}) => apiClient.get('/products', { params }).then((res) => res.data),
  getBySlug: (slug) => apiClient.get(`/products/${slug}`).then((res) => res.data),
  getRecommendations: (slug, params = {}) =>
    apiClient.get(`/products/${slug}/recommendations`, { params }).then((res) => res.data),
};
