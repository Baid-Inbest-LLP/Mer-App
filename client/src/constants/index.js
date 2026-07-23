export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'mer_access_token',
  REFRESH_TOKEN: 'mer_refresh_token',
  USER: 'mer_user',
  THEME: 'mer_theme',
};

export const ROUTES = {
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/',
  ENTRIES: '/entries',
  ENTRY_NEW: '/entries/new',
  ENTRY_EDIT: '/entries/:id/edit',
  ENTRY_VIEW: '/entries/:id',
  PURCHASE_ORDERS: '/purchase-orders',
  SUMMARY_REPORT: '/reports/summary',
  CUSTOMIZED_REPORT: '/reports/customized',
  FY_REPORT: '/reports/financial-year',
  SETTINGS: '/settings',
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
