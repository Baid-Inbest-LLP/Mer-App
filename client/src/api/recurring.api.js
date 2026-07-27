import api from './axios';

export const recurringApi = {
  list: (params) => api.get('/recurring-templates', { params }),
  get: (id) => api.get(`/recurring-templates/${id}`),
  create: (data) => api.post('/recurring-templates', data),
  update: (id, data) => api.put(`/recurring-templates/${id}`, data),
  remove: (id) => api.delete(`/recurring-templates/${id}`),
  generate: (id, data) => api.post(`/recurring-templates/${id}/generate`, data || {}),
  generateDue: (data) => api.post('/recurring-templates/generate-due', data || {}),
};
