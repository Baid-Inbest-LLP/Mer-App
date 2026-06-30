import { getFinancialYear } from '../config/index.js';

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

/** Full month name → three-letter label (Jan, Feb, …). */
export const abbreviateMonthName = (month) => {
  if (!month) return month;
  const trimmed = String(month).trim();
  const fromMap = MONTH_ABBREV[trimmed.toLowerCase()];
  if (fromMap) return fromMap;
  if (trimmed.length <= 3) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }
  return trimmed.slice(0, 3).charAt(0).toUpperCase() + trimmed.slice(1, 3).toLowerCase();
};

/** 2025-26 → 25-26 */
export const formatFyShort = (financialYear) => {
  const [start, end] = String(financialYear).split('-');
  if (!start || !end) return financialYear;
  return `${String(start).slice(-2)}-${end}`;
};

/**
 * EXP/{COMPANY_CODE}/{FY}/{MONTH}
 * Example: EXP/BSIBPL/25-26/Jan
 */
export const buildMerSerialBase = ({ companyCode, month, invoiceDate }) => {
  const code = String(companyCode || '').trim();
  if (!code || !month?.trim()) return null;

  const date = invoiceDate ? new Date(invoiceDate) : new Date();
  const fyShort = formatFyShort(getFinancialYear(date));
  const monthLabel = abbreviateMonthName(month);
  return `EXP/${code}/${fyShort}/${monthLabel}`;
};

/**
 * Appends /001, /002, … (always padded, including the first entry).
 * Example: EXP/BSIBPL/26-27/Feb/001
 */
export const buildMerSerial = (base, sequence) => {
  if (!base) return null;
  const seq = Math.max(1, parseInt(sequence, 10) || 1);
  return `${base}/${String(seq).padStart(3, '0')}`;
};
