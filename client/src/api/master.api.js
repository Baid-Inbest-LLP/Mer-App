import api from './axios';

export const masterApi = {
  lookups: () => api.get('/masters/lookups'),
  financialYears: () => api.get('/masters/financial-years'),
  vendors: () => api.get('/masters/vendors'),
  companies: () => api.get('/masters/companies'),
  locations: () => api.get('/masters/locations'),
  expenseHeads: () => api.get('/masters/expense-heads'),
  users: () => api.get('/masters/users'),
  createVendor: (data) => api.post('/masters/vendors', data),
  createCompany: (data) => api.post('/masters/companies', data),
  createLocation: (data) => api.post('/masters/locations', data),
  updateUser: (id, data) => api.put(`/masters/users/${id}`, data),
};
