import api from './axios';

export const purchaseOrderApi = {
  listCompleted: (params) => api.get('/purchase-orders/completed', { params }),
  get: (id) => api.get(`/purchase-orders/${id}`),
  getExpenseDraft: (id) => api.get(`/purchase-orders/${id}/expense-draft`),
  exclude: (id) => api.post(`/purchase-orders/${id}/exclude`),
};
