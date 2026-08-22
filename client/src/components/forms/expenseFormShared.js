import { formatNumber } from '../../utils/format';

export const TEXT_INPUT_CLASS_NAMES = {
  input: 'cursor-text',
  error: 'text-red-500 text-xs mt-1',
};

export const RADIO_GROUP_CLASS_NAMES = {
  label: 'expense-form-radio-group-label text-sm font-medium',
  error: 'text-red-500 text-xs mt-1',
};

export const RADIO_CLASS_NAMES = {
  radio: 'cursor-pointer',
  label: 'expense-form-radio-label cursor-pointer text-sm',
};

export const formatSummaryAmount = (value, decimals = 2) => `₹${formatNumber(value, decimals)}`;

export const toSelectValue = (value) => (value === '' || value === undefined ? null : value);

export const toDateOrNull = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
