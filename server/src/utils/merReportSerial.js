import {
  abbreviateMonthName,
  formatFyShort,
  formatMonthFyLabel,
  monthToDateInFy,
} from './merSerial.js';
import { toLocationLabel } from './locationFormat.js';
import { getFinancialYear } from '../config/index.js';

/** Bank → BNK, Cash → CASH, Combined → COMBINED */
export const abbreviateMonthlyReportMerType = (merType) => {
  const normalized = String(merType || '').trim().toLowerCase();
  if (normalized === 'cash') return 'CASH';
  if (normalized === 'bank') return 'BNK';
  if (normalized === 'combined' || normalized === 'comb') return 'COMBINED';
  return normalized ? normalized.toUpperCase() : 'COMBINED';
};

/**
 * {COMPANY_CODE}/MER/{MER_TYPE}/{MONTH'FY}
 * Example: BILLP/MER/COMBINED/Apr'26
 */
export const buildMonthlyReportNo = ({
  companyCode,
  month,
  financialYear,
  merType = 'combined',
}) => {
  const code = String(companyCode || '').trim();
  const type = abbreviateMonthlyReportMerType(merType);
  const fy = financialYear || getFinancialYear();
  const period = formatMonthFyLabel(month, monthToDateInFy(month, fy));
  if (!code || !type || !period) return null;
  return `${code}/MER/${type}/${period}`;
};

/** BILLP-MER-COMBINED-Apr26.xlsx */
export const buildMonthlyReportFilename = (params) => {
  const reportNo = buildMonthlyReportNo(params);
  if (!reportNo) return 'MER-monthly-report.xlsx';
  const slug = reportNo
    .replace(/\//g, '-')
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}.xlsx`;
};

export const resolveMonthlyReportMeta = async (query, Company) => {
  let companyCode;
  if (query.company) {
    const company = await Company.findOne({ name: query.company }).select('code').lean();
    companyCode = company?.code || undefined;
  }

  const params = {
    companyCode,
    month: query.month,
    financialYear: query.financialYear || getFinancialYear(),
    merType: query.merType || 'combined',
  };

  return {
    reportNo: buildMonthlyReportNo(params),
    filename: buildMonthlyReportFilename(params),
  };
};

/**
 * {COMPANY_CODE}/MER/{MER_TYPE}/{FY_SHORT}
 * Example: BILLP/MER/COMBINED/25-26
 */
export const buildFyReportNo = ({
  companyCode,
  financialYear,
  merType = 'combined',
}) => {
  const code = String(companyCode || '').trim();
  const type = abbreviateMonthlyReportMerType(merType);
  const fyShort = formatFyShort(financialYear || getFinancialYear());
  if (!code || !type || !fyShort) return null;
  return `${code}/MER/${type}/${fyShort}`;
};

/** BILLP-MER-COMBINED-25-26.xlsx */
export const buildFyReportFilename = (params) => {
  const reportNo = buildFyReportNo(params);
  if (!reportNo) return 'MER-fy-report.xlsx';
  const slug = reportNo
    .replace(/\//g, '-')
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}.xlsx`;
};

export const resolveFyReportMeta = async (query, Company) => {
  let companyCode;
  if (query.company) {
    const company = await Company.findOne({ name: query.company }).select('code').lean();
    companyCode = company?.code || undefined;
  }

  const params = {
    companyCode,
    financialYear: query.financialYear || getFinancialYear(),
    merType: query.merType || 'combined',
  };

  return {
    reportNo: buildFyReportNo(params),
    filename: buildFyReportFilename(params),
  };
};

const asSegment = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

/**
 * MER/{companyCode}/{location}/{expenseType}/{merType}/{fy}/{month}
 * Only segments provided by the user are included (financial year is required).
 */
export const buildCustomizedReportNo = ({
  financialYear,
  month,
  companyCode,
  location,
  expenseType,
  merType,
}) => {
  const fyShort = formatFyShort(financialYear);
  if (!fyShort) return null;

  const segments = ['MER'];
  const code = asSegment(companyCode);
  const branch = location ? toLocationLabel(location) : null;
  const type = asSegment(expenseType);
  const mer = asSegment(merType)?.toUpperCase() || null;
  const monthLabel = month ? abbreviateMonthName(month) : null;

  if (code) segments.push(code);
  if (branch) segments.push(branch);
  if (type) segments.push(type);
  if (mer) segments.push(mer);
  segments.push(fyShort);
  if (monthLabel) segments.push(monthLabel);

  return segments.join('/');
};

/** MER-{companyCode}-{location}-{expenseType}-{merType}-{fy}-{month}.xlsx */
export const buildCustomizedReportFilename = (params) => {
  const reportNo = buildCustomizedReportNo(params);
  if (!reportNo) return 'MER-report.xlsx';
  const slug = reportNo
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}.xlsx`;
};

export const resolveCustomizedReportMeta = async (query, Company) => {
  let companyCode;
  if (query.company) {
    const company = await Company.findOne({ name: query.company }).select('code').lean();
    companyCode = company?.code || undefined;
  }

  const params = {
    financialYear: query.financialYear || getFinancialYear(),
    month: query.month,
    companyCode,
    location: query.location,
    expenseType: query.expenseType,
    merType: query.merType,
  };

  return {
    reportNo: buildCustomizedReportNo(params),
    filename: buildCustomizedReportFilename(params),
  };
};
