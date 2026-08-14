export const REPORT_SCOPE = {
  DUE: 'due',
  EXPENSES: 'expenses',
};

export const REPORT_SCOPE_PATHS = [REPORT_SCOPE.DUE, REPORT_SCOPE.EXPENSES];

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

export const isDueReportScope = (scope) => normalizeReportScope(scope) === REPORT_SCOPE.DUE;

export const reportScopeNoun = (scope) => (isDueReportScope(scope) ? 'Due Bills' : 'Expenses');

export const reportScopeLabels = (scope) => {
  const due = isDueReportScope(scope);
  return {
    noun: due ? 'Due Bills' : 'Expenses',
    monthlyTitle: due ? 'Monthly Due Bills Report' : 'Monthly Expenses Report',
    fyTitle: due ? 'FY Due Bills Report' : 'FY Expenses Report',
    summaryTitle: due ? 'Due Bills Summary Report' : 'Expenses Summary Report',
    customizedTitle: due ? 'Customized Due Bills Report' : 'Customized Expenses Report',
    customizedSubtitle: due
      ? 'Build Due Bills Reports with Flexible Filters'
      : 'Build Expense Reports with Flexible Filters',
    monthlyTable: due ? 'Due Bills Monthly' : 'Expenses Monthly',
    fyTable: due ? 'Due Bills by Financial Year' : 'Expenses by Financial Year',
    entriesHeading: due ? 'Due Bill Entries' : 'Expense Entries',
    fyTotalLabel: due ? 'FY Bills Generated' : 'FY Total Expense',
    emptyPeriod: due
      ? 'No due bills are available for this period yet.'
      : 'No completed expenses are available for this period yet.',
    emptyYear: due
      ? 'No due bills are available for this financial year yet.'
      : 'No completed expenses are available for this financial year yet.',
    emptyAnyYear: due
      ? 'No due bills are available for any financial year yet.'
      : 'No completed entries are available for any financial year yet.',
    emptyMonth: (month) => (due
      ? `No due bills are available for ${month}.`
      : `No completed entries are available for ${month}.`),
    emptyFy: (fy) => (due
      ? `No due bills are available for ${fy}.`
      : `No completed entries are available for ${fy}.`),
    emptyDetailMonth: due
      ? 'No due bills are available for this month.'
      : 'No completed entries are available for this month.',
    emptyDetailFy: due
      ? 'No due bills are available for this financial year.'
      : 'No completed entries are available for this financial year.',
  };
};

export const withReportScope = (params = {}, scope) => {
  const normalized = normalizeReportScope(scope);
  if (!normalized) return { ...params };
  return { ...params, reportScope: normalized };
};
