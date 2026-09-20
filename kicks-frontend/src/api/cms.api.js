import { apiClient } from './client';

export const cmsApi = {
  list: () => apiClient.get('/cms').then((response) => response.data),
  getBySlug: (slug) => apiClient.get(`/cms/${slug}`).then((response) => response.data),
};
