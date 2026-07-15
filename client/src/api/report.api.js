import api from './axios';

export const reportApi = {
  summary: (params) => api.get('/reports/summary', { params }),
  headSummary: (params) => api.get('/reports/head-summary', { params }),
  monthly: (params) => api.get('/reports/monthly', { params }),
  financialYear: (params) => api.get('/reports/financial-year', { params }),
  monthlyDetailed: (params) => api.get('/reports/monthly/detailed', { params }),
  exportSummaryExcel: (params) =>
    api.get('/reports/export/excel', { params, responseType: 'blob' }),
  exportMonthlyExcel: (params) =>
    api.get('/reports/export/monthly', { params, responseType: 'blob' }),
  exportMonthlyPdf: (params) =>
    api.get('/reports/export/monthly/pdf', { params, responseType: 'blob' }),
};
