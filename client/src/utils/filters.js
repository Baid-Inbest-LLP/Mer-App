/** Drop payment-status and MER-type (bank/cash) keys before API calls. */
export function omitPaymentFilters(filters = {}) {
  const { status, merType, ...rest } = filters;
  return rest;
}

/** Remove empty filter values before sending query params. */
export function cleanFilterParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
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
