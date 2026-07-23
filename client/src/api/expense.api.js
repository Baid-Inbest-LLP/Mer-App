import api from './axios';

const MER_FORM_FIELDS = new Set([
  'month',
  'coNames',
  'invoiceDate',
  'location',
  'company',
  'invoiceNo',
  'headOfExpense',
  'particulars',
  'notes',
  'terms',
  'expenseType',
  'netAmount',
  'gstPercent',
  'gstAmount',
  'useIGST',
  'hasBillOrReceipt',
  'cgst',
  'sgst',
  'igst',
  'totalGST',
  'tds',
  'grossAmount',
  'paymentDate',
  'paymentRefNumber',
  'bankAccountNumber',
  'cardNumber',
  'merType',
  'paymentMethod',
  'isDraft',
  'purchaseOrderId',
  'poNumber',
  'source',
  'vendor',
]);

const serializePayload = (data) => {
  const payload = {};
  MER_FORM_FIELDS.forEach((key) => {
    const value = data[key];
    if (value === undefined || value === null) return;
    if (value instanceof Date) {
      payload[key] = value.toISOString();
    } else if (typeof value === 'boolean') {
      payload[key] = value;
    } else if (typeof value === 'string' && value.trim() === '') {
      return;
    } else if (typeof value !== 'object') {
      payload[key] = value;
    }
  });
  if (data.isDraft !== undefined) {
    payload.isDraft = data.isDraft;
  }
  return payload;
};

export const expenseApi = {
  list: (params) => api.get('/expenses', { params }),
  get: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', serializePayload(data)),
  update: (id, data) => api.put(`/expenses/${id}`, serializePayload(data)),
  remove: (id) => api.delete(`/expenses/${id}`),
  approve: (id) => api.patch(`/expenses/${id}/approve`),
  complete: (id) => api.patch(`/expenses/${id}/complete`),
  nextSlNo: (params) => api.get('/expenses/next-slno', { params }),
  calculate: (data) => api.post('/expenses/calculate', data),
};
