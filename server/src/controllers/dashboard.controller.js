import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analytics.service.js';

const toMonthQuery = ({ monthStart, monthEnd }) => ({
  invoiceDateFrom: monthStart.toISOString(),
  invoiceDateTo: monthEnd.toISOString(),
});

const chartContext = (month, financialYear) =>
  analyticsService.getFyMonthContext(month, financialYear);

export const getDashboard = asyncHandler(async (req, res) => {
  const defaultFy = analyticsService.getFyMonthContext().financialYear;
  const trendsFy = req.query.trendsFy || req.query.financialYear || defaultFy;
  const daysToClearFy = req.query.daysToClearFy || req.query.financialYear || defaultFy;
  const quarterlyFy = req.query.quarterlyFy || req.query.financialYear || defaultFy;

  const companyCtx = chartContext(req.query.companyMonth, req.query.companyFy || defaultFy);
  const expenseTypesCtx = chartContext(
    req.query.expenseTypesMonth,
    req.query.expenseTypesFy || defaultFy,
  );
  const paymentMethodsCtx = chartContext(
    req.query.paymentMethodsMonth,
    req.query.paymentMethodsFy || defaultFy,
  );
  const headCtx = chartContext(req.query.headMonth, req.query.headFy || defaultFy);

  const [
    kpis,
    trendsPack,
    expenseTypes,
    paymentMethods,
    headAnalytics,
    quarterly,
    companyBreakdown,
    daysToClearPack,
    recentEntries,
  ] = await Promise.all([
    analyticsService.getDashboardKPIs(),
    analyticsService.getExpenseTrends(12, trendsFy),
    analyticsService.getExpenseTypeBreakdown(toMonthQuery(expenseTypesCtx)),
    analyticsService.getPaymentMethodBreakdown(toMonthQuery(paymentMethodsCtx)),
    analyticsService.getHeadOfExpenseAnalytics(toMonthQuery(headCtx)),
    analyticsService.getQuarterlyOverview(quarterlyFy),
    analyticsService.getCompanyBreakdown(companyCtx.monthStart, companyCtx.monthEnd),
    analyticsService.getAvgDaysToClearByMonth(12, daysToClearFy),
    analyticsService.getRecentExpenses(5),
  ]);

  ApiResponse.success(res, {
    kpis,
    trends: trendsPack.data,
    expenseTypes: expenseTypes.map((e) => ({ name: e._id, value: e.total, count: e.count })),
    paymentMethods: paymentMethods.map((p) => ({ name: p._id, value: p.total })),
    headAnalytics: headAnalytics.map((h) => ({ name: h._id, value: h.total })),
    quarterly: quarterly.map((q) => ({ quarter: q._id, total: q.total, count: q.count })),
    companyChart: companyBreakdown,
    daysToClear: daysToClearPack.data,
    recentEntries,
    fyMonthOptions: companyCtx.fyMonthOptions,
    fyLabel: companyCtx.fyLabel,
    currentFinancialYear: defaultFy,
    selectedMonths: {
      company: companyCtx.selectedMonth,
      expenseTypes: expenseTypesCtx.selectedMonth,
      paymentMethods: paymentMethodsCtx.selectedMonth,
      head: headCtx.selectedMonth,
    },
    selectedFys: {
      company: companyCtx.financialYear,
      expenseTypes: expenseTypesCtx.financialYear,
      paymentMethods: paymentMethodsCtx.financialYear,
      head: headCtx.financialYear,
      trends: trendsPack.financialYear || trendsFy,
      daysToClear: daysToClearPack.financialYear || daysToClearFy,
      quarterly: quarterlyFy,
    },
    chartMonthOptions: {
      company: companyCtx.fyMonthOptions,
      expenseTypes: expenseTypesCtx.fyMonthOptions,
      paymentMethods: paymentMethodsCtx.fyMonthOptions,
      head: headCtx.fyMonthOptions,
    },
  });
});
