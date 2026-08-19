import { isDueReportScope } from './reportScope';

const reportSerialKind = (reportScope) => (isDueReportScope(reportScope) ? 'BILL' : 'MER');

export const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const wordsUnderHundred = (n) => {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = n % 10 ? ` ${ONES[n % 10]}` : '';
  return `${tens}${ones}`;
};

const wordsUnderThousand = (n) => {
  if (n < 100) return wordsUnderHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return `${ONES[hundreds]} Hundred${rest ? ` ${wordsUnderHundred(rest)}` : ''}`;
};

const numberToIndianWords = (n) => {
  if (n === 0) return 'Zero';

  let num = Math.floor(n);
  let result = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore) result += `${wordsUnderHundred(crore)} Crore `;
  if (lakh) result += `${wordsUnderHundred(lakh)} Lakh `;
  if (thousand) result += `${wordsUnderThousand(thousand)} Thousand `;
  if (num) {
    result += (result && num < 100 ? 'and ' : '') + wordsUnderThousand(num);
  }

  return result.trim();
};

/** Indian Rupees amount in words (e.g. "Rupees Five Thousand Only"). */
export const formatAmountInWords = (value) => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  let words = numberToIndianWords(rupees);
  words = `Rupees ${words}`;
  if (paise > 0) {
    words += ` and ${numberToIndianWords(paise)} Paise`;
  }
  words += ' Only';

  return num < 0 ? `Minus ${words}` : words;
};

export const formatNumber = (value, decimals = 2) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatPercent = (value) => {
  const num = Number(value) || 0;
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
};

const MONTH_ABBREV = {
  january: 'Jan',
  february: 'Feb',
  march: 'Mar',
  april: 'Apr',
  may: 'May',
  june: 'Jun',
  july: 'Jul',
  august: 'Aug',
  september: 'Sep',
  october: 'Oct',
  november: 'Nov',
  december: 'Dec',
};

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const monthToDateInFy = (month, financialYear) => {
  const startYear = parseInt(String(financialYear).split('-')[0], 10);
  const idx = MONTH_INDEX[String(month || '').trim().toLowerCase()];
  if (!startYear || idx === undefined) return null;
  const year = idx >= 3 ? startYear : startYear + 1;
  return new Date(year, idx, 15);
};

const getFinancialYearFromDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
};

/** e.g. April + 2026-27 → Apr'26 */
export const formatMonthFyPeriodLabel = (month, financialYear) => {
  const trimmed = String(month || '').trim();
  if (!trimmed) return '';

  const monthLabel = MONTH_ABBREV[trimmed.toLowerCase()]
    || (trimmed.length <= 3
      ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
      : trimmed.slice(0, 3).charAt(0).toUpperCase() + trimmed.slice(1, 3).toLowerCase());

  const date = monthToDateInFy(trimmed, financialYear);
  if (!date) return trimmed;

  const [startYear] = getFinancialYearFromDate(date).split('-');
  return `${monthLabel}'${String(startYear).slice(-2)}`;
};

const abbreviateMonthlyReportMerType = (merType) => {
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
} = {}) => {
  const code = String(companyCode || '').trim();
  const type = abbreviateMonthlyReportMerType(merType);
  if (!code || !month || !financialYear) return null;

  const trimmed = String(month).trim();
  const fromMap = MONTH_ABBREV[trimmed.toLowerCase()];
  const monthLabel = fromMap
    || (trimmed.length <= 3
      ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
      : trimmed.slice(0, 3).charAt(0).toUpperCase() + trimmed.slice(1, 3).toLowerCase());
  const [startYear] = String(financialYear).split('-');
  const yy = String(startYear).slice(-2);
  const period = `${monthLabel}'${yy}`;
  const kind = reportSerialKind(reportScope);

  return `${code}/${kind}/${type}/${period}`;
};

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

/** 2025-26 → 25-26 */
export const formatFyShortLabel = (financialYear) => {
  const [start, end] = String(financialYear || '').split('-');
  if (!start || !end) return financialYear || '';
  return `${String(start).slice(-2)}-${end}`;
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
} = {}) => {
  const code = String(companyCode || '').trim();
  const type = abbreviateMonthlyReportMerType(merType);
  const fyShort = formatFyShortLabel(financialYear);
  if (!code || !type || !fyShort) return null;
  const kind = reportSerialKind(reportScope);
  return `${code}/${kind}/${type}/${fyShort}`;
};

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

const abbreviateMonth = (month) => {
  if (!month) return null;
  const trimmed = String(month).trim();
  const fromMap = MONTH_ABBREV[trimmed.toLowerCase()];
  if (fromMap) return fromMap;
  if (trimmed.length <= 3) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }
  return trimmed.slice(0, 3).charAt(0).toUpperCase() + trimmed.slice(1, 3).toLowerCase();
};

const monthRangeLabel = (month) => {
  if (!month) return null;
  const parts = (Array.isArray(month)
    ? month
    : String(month).split(',').map((item) => item.trim()).filter(Boolean));
  if (!parts.length) return null;
  const order = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March',
  ];
  const unique = [...new Set(parts)];
  unique.sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
  return unique.map((item) => abbreviateMonth(item)).filter(Boolean).join('-');
};

/**
 * {KIND}/{companyCode}/{coName}/{location}/{expenseType}/{merType}/{fy}/{month}
 * Only includes filter segments provided by the user (financial year required).
 */
export const buildCustomizedReportNo = (params, companyCodeByName = {}) => {
  const {
    financialYear,
    month,
    company,
    coNames,
    location,
    expenseType,
    merType,
    reportScope,
  } = params;
  if (!financialYear) return null;

  const [start, end] = String(financialYear).split('-');
  const fyShort = start && end ? `${String(start).slice(-2)}-${end}` : String(financialYear);
  const monthLabel = monthRangeLabel(month);
  const monthCount = monthLabel ? monthLabel.split('-').filter(Boolean).length : 0;

  if (monthCount > 1) {
    return `${reportSerialKind(reportScope)}/${fyShort}/${monthLabel}`;
  }

  const segments = [reportSerialKind(reportScope)];

  if (company && companyCodeByName[company]) segments.push(companyCodeByName[company]);
  if (coNames) segments.push(String(coNames).trim().replace(/\s+/g, '').toUpperCase());
  if (location) segments.push(String(location).trim().replace(/\s+/g, '').toUpperCase());
  if (expenseType) segments.push(String(expenseType).trim());
  if (merType) segments.push(String(merType).trim().toUpperCase());
  segments.push(fyShort);
  if (monthLabel) segments.push(monthLabel);

  return segments.join('/');
};

/** MER-...xlsx | BILL-...xlsx */
export const buildCustomizedReportFilename = (params, companyCodeByName = {}) => {
  const reportNo = buildCustomizedReportNo(params, companyCodeByName);
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

/** Display bill / expense serial with abbreviated month (handles legacy full month names in DB). */
export const formatMerSerial = (slNo) => {
  if (!slNo) return slNo;
  let result = String(slNo).replace(/^MER\//, 'EXP/');
  Object.entries(MONTH_ABBREV).forEach(([full, abbr]) => {
    result = result.replace(new RegExp(`/${full}(/|$)`, 'gi'), `/${abbr}$1`);
  });
  return result;
};

export const isExpenseSerial = (slNo) => /^([^/]+)\/EXP\//i.test(String(slNo || '').trim());

export const getSerialLabel = (slNo) => (isExpenseSerial(slNo) ? 'Expense No' : 'Bill No');

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfLocalDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Calendar days from due (or invoice) date to full payment.
 * Uses stored daysToClear when present; otherwise derives from dates.
 * Returns null when the bill is not fully paid or dates are missing.
 */
export const resolveDaysToClear = (expense) => {
  if (!expense || expense.status !== 'Paid') return null;
  if (expense.daysToClear != null && expense.daysToClear !== '') {
    return Number(expense.daysToClear);
  }
  const anchor = expense.dueDate || expense.invoiceDate;
  const cleared = expense.clearedAt || expense.paymentDate;
  if (!anchor || !cleared) return null;
  return Math.round((startOfLocalDay(cleared) - startOfLocalDay(anchor)) / MS_PER_DAY);
};

/** Human-readable clearance time, e.g. "12 days", "1 day", "3 days early". */
export const formatDaysToClear = (days) => {
  if (days == null || Number.isNaN(Number(days))) return '—';
  const n = Number(days);
  const abs = Math.abs(n);
  const unit = abs === 1 ? 'day' : 'days';
  if (n < 0) return `${abs} ${unit} early`;
  if (n === 0) return 'Same day';
  return `${n} ${unit}`;
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'Paid':
      return 'green';
    case 'PartiallyPaid':
      return 'blue';
    case 'Pending':
      return 'yellow';
    case 'Hold':
      return 'orange';
    case 'Cancelled':
      return 'red';
    default:
      return 'gray';
  }
};

export const getApprovalStatusColor = (status) => {
  switch (status) {
    case 'Approved':
      return 'blue';
    case 'Completed':
      return 'green';
    case 'Pending':
      return 'orange';
    default:
      return 'gray';
  }
};

export const getApprovalStatusBadge = (status) => {
  switch (status) {
    case 'Approved':
      return 'badge-approved';
    case 'Completed':
      return 'badge-completed';
    case 'Pending':
      return 'badge-pending';
    case 'Draft':
      return 'badge-draft';
    default:
      return 'badge bg-gray-100 text-gray-700';
  }
};

export const getEntryApprovalLabel = (expense) => {
  if (expense?.isDraft) return 'Draft';
  return expense?.approvalStatus || 'Pending';
};

export const getEntryApprovalBadge = (expense) => {
  if (expense?.isDraft) return getApprovalStatusBadge('Draft');
  return getApprovalStatusBadge(expense?.approvalStatus);
};

export const getPaymentStatusLabel = (status) => {
  switch (status) {
    case 'PartiallyPaid':
      return 'Partially Paid';
    case 'Hold':
      return 'On Hold';
    default:
      return status || 'Pending';
  }
};

export const getPaymentStatusBadge = (status) => {
  switch (status) {
    case 'Paid':
      return 'badge-paid';
    case 'PartiallyPaid':
      return 'badge-partially-paid';
    case 'Pending':
      return 'badge-payment-pending';
    case 'Hold':
      return 'badge-hold';
    case 'Cancelled':
      return 'badge-cancelled';
    default:
      return 'badge bg-gray-100 text-gray-700';
  }
};

export const getApprovalStatusGradient = (status) => {
  switch (status) {
    case 'Approved':
      return 'from-blue-500 to-indigo-600';
    case 'Completed':
      return 'from-emerald-500 to-green-600';
    case 'Pending':
      return 'from-amber-500 to-orange-500';
    default:
      return 'from-gray-500 to-gray-600';
  }
};

