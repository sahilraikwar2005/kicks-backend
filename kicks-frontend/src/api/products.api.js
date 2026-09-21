import { apiClient } from './client';

const isEmptyParam = (value) => value === undefined || value === null || value === '' || (typeof value === 'string' && value.trim() === '');

export const cleanParams = (params = {}) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (!isEmptyParam(value)) cleaned[key] = value;
  }
  return cleaned;
};

export const productsApi = {
  getFeatured: () => apiClient.get('/products/featured').then((res) => res.data),
  getList: (params = {}) => apiClient.get('/products', { params: cleanParams(params) }).then((res) => res.data),
  getBySlug: (slug) => apiClient.get(`/products/${slug}`).then((res) => res.data),
  getRecommendations: (slug, params = {}) =>
    apiClient.get(`/products/${slug}/recommendations`, { params: cleanParams(params) }).then((res) => res.data),
};
