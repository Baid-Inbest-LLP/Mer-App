import api from './axios';

export const bankAccountsApi = {
  getAll: (params) => api.get('/bank-accounts', { params }),
  getOne: (id) => api.get(`/bank-accounts/${id}`),
  create: (data) => api.post('/bank-accounts', data),
  update: (id, data) => api.put(`/bank-accounts/${id}`, data),
  delete: (id) => api.delete(`/bank-accounts/${id}`),
};
