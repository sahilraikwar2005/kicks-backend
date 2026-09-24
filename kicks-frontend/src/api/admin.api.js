import { apiClient } from './client';

export const adminApi = {
  dashboard: () => apiClient.get('/admin/dashboard').then((response) => response.data),
  salesOverview: (range = 'today') => apiClient.get('/admin/sales-overview', { params: { range } }).then((response) => response.data),
  users: (params = {}) => apiClient.get('/admin/users', { params }).then((response) => response.data),
  userById: (id) => apiClient.get(`/admin/users/${id}`).then((response) => response.data),
  updateUserStatus: (id, isActive) => apiClient.patch(`/admin/users/${id}/status`, { isActive }).then((response) => response.data),
  inventory: (params = {}) => apiClient.get('/admin/inventory', { params }).then((response) => response.data),
  lowStock: () => apiClient.get('/admin/inventory/low-stock').then((response) => response.data),
  inventoryMovements: (variantId, params = {}) => apiClient.get(`/admin/inventory/${variantId}/movements`, { params }).then((response) => response.data),
  settings: () => apiClient.get('/admin/settings').then((response) => response.data),
  updateSetting: (key, payload) => apiClient.patch(`/admin/settings/${key}`, payload).then((response) => response.data),
  shipments: (params = {}) => apiClient.get('/admin/shipments', { params }).then((response) => response.data),
  shipmentById: (id) => apiClient.get(`/admin/shipments/${id}`).then((response) => response.data),
  createShipment: (orderId) => apiClient.post(`/admin/orders/${orderId}/ship`).then((response) => response.data),
  shipmentLabelUrl: (id) => `${apiClient.defaults.baseURL}/admin/shipments/${id}/label`,
  scheduleMockPickup: (id) => apiClient.post(`/admin/shipments/${id}/pickup`).then((response) => response.data),
  simulateMockEvent: (id, event) => apiClient.post(`/admin/shipments/${id}/mock/event`, { event }).then((response) => response.data),
};
