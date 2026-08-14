import { PAYMENT_STATUS } from '../constants/paymentStatus.js';

export const REPORT_SCOPE = {
  DUE: 'due',
  EXPENSES: 'expenses',
};

export const normalizeReportScope = (value) => {
  const scope = String(value || '').trim().toLowerCase();
  if (scope === 'due' || scope === 'due-bills' || scope === 'bills') {
    return REPORT_SCOPE.DUE;
  }
  if (scope === 'expenses' || scope === 'expense' || scope === 'paid') {
    return REPORT_SCOPE.EXPENSES;
  }
  return null;
};

/**
 * Restrict a Mongo filter to bills vs paid expenses.
 * Due/bills reports include every generated bill (paid and unpaid), excluding cancelled.
 * Expense reports include only paid bills.
 * Unknown / empty scope leaves the filter unchanged (legacy mixed reports).
 */
export const applyReportScope = (filter, scope) => {
  const normalized = normalizeReportScope(scope);
  if (normalized === REPORT_SCOPE.DUE) {
    filter.status = { $ne: PAYMENT_STATUS.CANCELLED };
    delete filter.balanceDue;
  } else if (normalized === REPORT_SCOPE.EXPENSES) {
    filter.status = PAYMENT_STATUS.PAID;
  }
  return filter;
};
