import { apiClient } from './client';

export const notificationsApi = {
  list: () => apiClient.get('/notifications').then((response) => response.data),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`).then((response) => response.data),
};
