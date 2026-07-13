import api from './axios';

export const cardsApi = {
  getAll: (params) => api.get('/cards', { params }),
  getOne: (id) => api.get(`/cards/${id}`),
  create: (data) => api.post('/cards', data),
  update: (id, data) => api.put(`/cards/${id}`, data),
  delete: (id) => api.delete(`/cards/${id}`),
};
