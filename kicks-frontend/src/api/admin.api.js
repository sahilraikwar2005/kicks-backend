import { apiClient } from './client';

export const adminApi = {
  dashboard: () => apiClient.get('/admin/dashboard').then((response) => response.data),
  users: (params = {}) => apiClient.get('/admin/users', { params }).then((response) => response.data),
  userById: (id) => apiClient.get(`/admin/users/${id}`).then((response) => response.data),
  updateUserStatus: (id, isActive) => apiClient.patch(`/admin/users/${id}/status`, { isActive }).then((response) => response.data),
  inventory: (params = {}) => apiClient.get('/admin/inventory', { params }).then((response) => response.data),
  lowStock: () => apiClient.get('/admin/inventory/low-stock').then((response) => response.data),
  inventoryMovements: (variantId, params = {}) => apiClient.get(`/admin/inventory/${variantId}/movements`, { params }).then((response) => response.data),
  settings: () => apiClient.get('/admin/settings').then((response) => response.data),
  updateSetting: (key, payload) => apiClient.patch(`/admin/settings/${key}`, payload).then((response) => response.data),
  auditLogs: (params = {}) => apiClient.get('/admin/audit-logs', { params }).then((response) => response.data),
  notifications: (params = {}) => apiClient.get('/admin/notifications', { params }).then((response) => response.data),
  markNotificationRead: (id) => apiClient.patch(`/admin/notifications/${id}`).then((response) => response.data),
  generateAiProduct: (payload) => apiClient.post('/admin/ai/product-generate', payload).then((response) => response.data),
  regenerateAiProduct: (payload) => apiClient.post('/admin/ai/product-regenerate', payload).then((response) => response.data),
  regenerateAiField: (payload) => apiClient.post('/admin/ai/product-description', payload).then((response) => response.data),
  regenerateSeo: (payload) => apiClient.post('/admin/ai/product-seo', payload).then((response) => response.data),
  shipments: (params = {}) => apiClient.get('/admin/shipments', { params }).then((response) => response.data),
  shipmentById: (id) => apiClient.get(`/admin/shipments/${id}`).then((response) => response.data),
  createShipment: (orderId) => apiClient.post(`/admin/orders/${orderId}/ship`).then((response) => response.data),
};
