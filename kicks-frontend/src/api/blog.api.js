import { apiClient } from './client';

export const blogApi = {
  list: () => apiClient.get('/blog').then((response) => response.data),
  getBySlug: (slug) => apiClient.get(`/blog/${slug}`).then((response) => response.data),
};
