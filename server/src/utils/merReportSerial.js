import { abbreviateMonthName, formatFyShort } from './merSerial.js';
import { toLocationLabel } from './locationFormat.js';
import { getFinancialYear } from '../config/index.js';

/**
 * MER/{FY}/{MONTH}
 * Example: MER/26-27/Jun
 */
export const buildMonthlyReportNo = ({ financialYear, month }) => {
  const fyShort = formatFyShort(financialYear);
  const monthLabel = abbreviateMonthName(month);
  if (!fyShort || !monthLabel) return null;
  return `MER/${fyShort}/${monthLabel}`;
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
