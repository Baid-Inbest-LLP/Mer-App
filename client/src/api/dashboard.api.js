import api from './axios';

export const dashboardApi = {
  get: (params) => api.get('/dashboard', { params }),
};

export const analyticsApi = {
  trends: (params) => api.get('/analytics/trends', { params }),
  expenseTypes: (params) => api.get('/analytics/expense-types', { params }),
  paymentMethods: (params) => api.get('/analytics/payment-methods', { params }),
  companyChart: (params) => api.get('/analytics/company-chart', { params }),
  heads: (params) => api.get('/analytics/heads', { params }),
  quarterly: (params) => api.get('/analytics/quarterly', { params }),
  fyComparison: (params) => api.get('/analytics/fy-comparison', { params }),
};
