import api from './axios';

export const companiesApi = {
  getAll: (params) => api.get('/companies', { params }),
  getOne: (id) => api.get(`/companies/${id}`),
  getStamp: (id) => api.get(`/companies/${id}/stamp`),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  delete: (id) => api.delete(`/companies/${id}`),
};
