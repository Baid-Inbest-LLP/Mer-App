import api from './axios';

export const masterApi = {
  lookups: () => api.get('/masters/lookups'),
  financialYears: () => api.get('/masters/financial-years'),
  vendors: () => api.get('/masters/vendors'),
  companies: () => api.get('/masters/companies'),
  locations: () => api.get('/masters/locations'),
  expenseHeads: (params) => api.get('/masters/expense-heads', { params }),
  createExpenseHead: (data) => api.post('/masters/expense-heads', data),
  updateExpenseHead: (id, data) => api.put(`/masters/expense-heads/${id}`, data),
  deleteExpenseHead: (id) => api.delete(`/masters/expense-heads/${id}`),
  users: () => api.get('/masters/users'),
  createVendor: (data) => api.post('/masters/vendors', data),
  createCompany: (data) => api.post('/masters/companies', data),
  createLocation: (data) => api.post('/masters/locations', data),
  updateUser: (id, data) => api.put(`/masters/users/${id}`, data),
  deleteUser: (id) => api.delete(`/masters/users/${id}`),
};
