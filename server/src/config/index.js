import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_NAME = process.env.MONGODB_DB_NAME || 'mer_db';

/** Ensure Atlas/local URI has database name + standard query params. */
export const normalizeMongoUri = (rawUri) => {
  if (!rawUri) return `mongodb://127.0.0.1:27017/${DB_NAME}`;

  let uri = rawUri.trim();

  if (uri.includes('mongodb.net')) {
    if (!/\.mongodb\.net\/[a-zA-Z0-9_-]+/.test(uri)) {
      uri = uri.replace(/\.mongodb\.net\/?/, `.mongodb.net/${DB_NAME}`);
    }
    if (!uri.includes('retryWrites=')) {
      uri += uri.includes('?') ? '&retryWrites=true&w=majority' : '?retryWrites=true&w=majority';
    }
    return uri;
  }

  if (!/:\d+\/[^/?]+/.test(uri)) {
    uri = uri.replace(/\/?$/, `/${DB_NAME}`);
  }

  return uri;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5002,
  mongodbUri: normalizeMongoUri(process.env.MONGODB_URI),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  clientUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  /** Read-only URI for PO-Software MongoDB (completed POs → MER expenses). */
  poMongodbUri: process.env.PO_MONGODB_URI || '',
  upload: {
    dir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
    maxSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
    allowedMime: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'MER System <noreply@mer.local>',
  },
};

export const EXPENSE_HEADS = [
  'COS',
  'Couriers',
  'Employee Benefit Experience',
  'F&B',
  'Housekeeping',
  'IT Accessories',
  'Medicine',
  'Electrical',
  'NAS',
  'Puja Expense',
  'Stationary',
  'TA',
  'Utility',
  'Fuel & Parking',
  'Subscription',
  'Miscellaneous',
];

export const EXPENSE_TYPES = ['Capital', 'Revenue'];
export const PAYMENT_METHODS = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Card', 'Cash'];
export const EXPENSE_STATUSES = ['Paid', 'Pending', 'Cancelled'];
export const USER_ROLES = ['superadmin', 'admin', 'user'];
export const APPROVAL_STATUSES = ['Pending', 'Completed', 'Approved'];

// Indian financial year: April to March
export const getFinancialYear = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
};

export const getFinancialYearRange = (fy) => {
  const [startYear] = fy.split('-').map(Number);
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
};
