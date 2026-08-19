import {
  formatFyShort,
  formatMonthFyLabel,
  formatMonthRangeAbbrev,
  monthToDateInFy,
} from './merSerial.js';
import { toLocationLabel } from './locationFormat.js';
import { getFinancialYear } from '../config/index.js';
import { normalizeReportScope, REPORT_SCOPE } from './reportScope.js';

/** MER for paid expenses; BILL for due bills reports. */
export const reportSerialKind = (reportScope) => (
  normalizeReportScope(reportScope) === REPORT_SCOPE.DUE ? 'BILL' : 'MER'
);

/** Bank → BNK, Cash → CASH, Combined → COMBINED */
export const abbreviateMonthlyReportMerType = (merType) => {
  const normalized = String(merType || '').trim().toLowerCase();
  if (normalized === 'cash') return 'CASH';
  if (normalized === 'bank') return 'BNK';
  if (normalized === 'combined' || normalized === 'comb') return 'COMBINED';
  return normalized ? normalized.toUpperCase() : 'COMBINED';
};

/**
 * {COMPANY_CODE}/{KIND}/{MER_TYPE}/{MONTH'FY}
 * Example: BILLP/MER/COMBINED/Apr'26 | BILLP/BILL/BNK/Apr'26
 */
export const buildMonthlyReportNo = ({
  companyCode,
  month,
  financialYear,
  merType = 'combined',
  reportScope,
}) => {
  const code = String(companyCode || '').trim();
  const type = abbreviateMonthlyReportMerType(merType);
  const fy = financialYear || getFinancialYear();
  const period = formatMonthFyLabel(month, monthToDateInFy(month, fy));
  if (!code || !type || !period) return null;
  const kind = reportSerialKind(reportScope);
  return `${code}/${kind}/${type}/${period}`;
};

/** BILLP-MER-COMBINED-Apr26.xlsx | BILLP-BILL-BNK-Apr26.xlsx */
export const buildMonthlyReportFilename = (params) => {
  const reportNo = buildMonthlyReportNo(params);
  if (!reportNo) {
    return reportSerialKind(params?.reportScope) === 'BILL'
      ? 'BILL-monthly-report.xlsx'
      : 'MER-monthly-report.xlsx';
  }
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
    reportScope: query.reportScope,
  };

  return {
    reportNo: buildMonthlyReportNo(params),
    filename: buildMonthlyReportFilename(params),
  };
};

/**
 * {COMPANY_CODE}/{KIND}/{MER_TYPE}/{FY_SHORT}
 * Example: BILLP/MER/COMBINED/25-26 | BILLP/BILL/CASH/25-26
 */
export const buildFyReportNo = ({
  companyCode,
  financialYear,
  merType = 'combined',
  reportScope,
}) => {
  const code = String(companyCode || '').trim();
  const type = abbreviateMonthlyReportMerType(merType);
  const fyShort = formatFyShort(financialYear || getFinancialYear());
  if (!code || !type || !fyShort) return null;
  const kind = reportSerialKind(reportScope);
  return `${code}/${kind}/${type}/${fyShort}`;
};

/** BILLP-MER-COMBINED-25-26.xlsx | BILLP-BILL-COMBINED-25-26.xlsx */
export const buildFyReportFilename = (params) => {
  const reportNo = buildFyReportNo(params);
  if (!reportNo) {
    return reportSerialKind(params?.reportScope) === 'BILL'
      ? 'BILL-fy-report.xlsx'
      : 'MER-fy-report.xlsx';
  }
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
    reportScope: query.reportScope,
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

const asCoNameSegment = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.replace(/\s+/g, '').toUpperCase() : null;
};

/**
 * {KIND}/{companyCode}/{coName}/{location}/{expenseType}/{merType}/{fy}/{month}
 * Only segments provided by the user are included (financial year is required).
 */
export const buildCustomizedReportNo = ({
  financialYear,
  month,
  companyCode,
  coNames,
  location,
  expenseType,
  merType,
  reportScope,
}) => {
  const fyShort = formatFyShort(financialYear);
  if (!fyShort) return null;

  const kind = reportSerialKind(reportScope);
  const monthLabel = formatMonthRangeAbbrev(month);
  const months = monthLabel ? monthLabel.split('-').filter(Boolean) : [];

  if (months.length > 1) {
    return `${kind}/${fyShort}/${monthLabel}`;
  }

  const segments = [kind];
  const code = asSegment(companyCode);
  const coName = asCoNameSegment(coNames);
  const branch = location ? toLocationLabel(location) : null;
  const type = asSegment(expenseType);
  const mer = asSegment(merType)?.toUpperCase() || null;

  if (code) segments.push(code);
  if (coName) segments.push(coName);
  if (branch) segments.push(branch);
  if (type) segments.push(type);
  if (mer) segments.push(mer);
  segments.push(fyShort);
  if (monthLabel) segments.push(monthLabel);

  return segments.join('/');
};

/** MER-...xlsx | BILL-...xlsx */
export const buildCustomizedReportFilename = (params) => {
  const reportNo = buildCustomizedReportNo(params);
  if (!reportNo) {
    return reportSerialKind(params?.reportScope) === 'BILL'
      ? 'BILL-report.xlsx'
      : 'MER-report.xlsx';
  }
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
    coNames: query.coNames,
    location: query.location,
    expenseType: query.expenseType,
    merType: query.merType,
    reportScope: query.reportScope,
  };

  return {
    reportNo: buildCustomizedReportNo(params),
    filename: buildCustomizedReportFilename(params),
  };
};
