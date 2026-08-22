import { FY_MONTH_ORDER } from './financialYear';

/** Drop payment-status and MER-type (bank/cash) keys before API calls. */
export function omitPaymentFilters(filters = {}) {
  const { status: _s, merType: _m, ...rest } = filters;
  void _s;
  void _m;
  return rest;
}

/** Remove empty filter values before sending query params. */
export function cleanFilterParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

/**
 * Clean report query params; sorts multi-select months in FY order.
 * Used by customized report and any page with month multi-select.
 */
export function cleanReportParams(params = {}) {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'month') {
      const items = (Array.isArray(value) ? value : String(value).split(','))
        .map((item) => String(item).trim())
        .filter(Boolean)
        .sort((a, b) => FY_MONTH_ORDER.indexOf(a) - FY_MONTH_ORDER.indexOf(b));
      if (items.length) out.month = items.join(',');
      return;
    }
    if (Array.isArray(value)) {
      const items = value.filter(Boolean);
      if (items.length) out[key] = items.join(',');
      return;
    }
    out[key] = value;
  });
  return out;
}

const EXPENSE_LIST_HIDDEN_FILTERS = ['timeframe', 'quarter', 'coNames'];

const SUMMARY_REPORT_HIDDEN_FILTERS = ['timeframe'];

/** Strip filters hidden on the expense list page. */
export function stripExpenseListHiddenFilters(filters = {}) {
  const next = { ...filters };
  EXPENSE_LIST_HIDDEN_FILTERS.forEach((key) => delete next[key]);
  return next;
}

/** Strip filters hidden on the summary report page. */
export function stripSummaryReportHiddenFilters(filters = {}) {
  const next = { ...filters };
  SUMMARY_REPORT_HIDDEN_FILTERS.forEach((key) => delete next[key]);
  return next;
}
