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

/** Cash → CASH, Bank → BNK */
export const abbreviateMerType = (merType) => {
  const normalized = String(merType || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'cash') return 'CASH';
  if (normalized === 'bank') return 'BNK';
  return null;
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

/** Map month name + FY to a representative date (Indian FY: Apr–Mar). */
export const monthToDateInFy = (month, financialYear) => {
  const startYear = parseInt(String(financialYear).split('-')[0], 10);
  const idx = MONTH_INDEX[String(month || '').trim().toLowerCase()];
  if (!startYear || idx === undefined) return new Date();
  const year = idx >= 3 ? startYear : startYear + 1;
  return new Date(year, idx, 15);
};

/**
 * Month + FY start year, e.g. Apr'26 for April in FY 2026-27.
 */
export const formatMonthFyLabel = (month, invoiceDate) => {
  const monthLabel = abbreviateMonthName(month);
  if (!monthLabel) return null;

  const date = invoiceDate ? new Date(invoiceDate) : new Date();
  const [startYear] = getFinancialYear(date).split('-');
  const yy = String(startYear).slice(-2);
  return `${monthLabel}'${yy}`;
};

/**
 * {COMPANY_CODE}/EXP/{MER_TYPE}/{MONTH'FY}
 * Example: BSIBPL/EXP/BNK/Apr'26
 */
export const buildMerSerialBase = ({ companyCode, month, invoiceDate, merType }) => {
  const code = String(companyCode || '').trim();
  const type = abbreviateMerType(merType);
  const period = formatMonthFyLabel(month, invoiceDate);
  if (!code || !type || !period) return null;

  return `${code}/EXP/${type}/${period}`;
};

/**
 * Appends /001, /002, … (always padded, including the first entry).
 * Example: BSIBPL/EXP/BNK/Apr'26/001
 */
export const buildMerSerial = (base, sequence) => {
  if (!base) return null;
  const seq = Math.max(1, parseInt(sequence, 10) || 1);
  return `${base}/${String(seq).padStart(3, '0')}`;
};

/** Escape a string for use inside a RegExp. */
export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex matching serial numbers under a given base (…/001, …/002, …). */
export const buildMerSerialPattern = (base) => {
  if (!base) return null;
  return new RegExp(`^${escapeRegex(base)}/\\d{3}$`, 'i');
};
