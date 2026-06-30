import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analytics.service.js';

const toMonthQuery = ({ monthStart, monthEnd }) => ({
  invoiceDateFrom: monthStart.toISOString(),
  invoiceDateTo: monthEnd.toISOString(),
});

export const getDashboard = asyncHandler(async (req, res) => {
  const companyCtx = analyticsService.getFyMonthContext(req.query.companyMonth);
  const expenseTypesCtx = analyticsService.getFyMonthContext(req.query.expenseTypesMonth);
  const paymentMethodsCtx = analyticsService.getFyMonthContext(req.query.paymentMethodsMonth);
  const headCtx = analyticsService.getFyMonthContext(req.query.headMonth);

  const [
    kpis,
    trends,
    expenseTypes,
    paymentMethods,
    headAnalytics,
    quarterly,
    companyBreakdown,
    recentEntries,
  ] = await Promise.all([
    analyticsService.getDashboardKPIs(),
    analyticsService.getExpenseTrends(12),
    analyticsService.getExpenseTypeBreakdown(toMonthQuery(expenseTypesCtx)),
    analyticsService.getPaymentMethodBreakdown(toMonthQuery(paymentMethodsCtx)),
    analyticsService.getHeadOfExpenseAnalytics(toMonthQuery(headCtx)),
    analyticsService.getQuarterlyOverview(req.query.financialYear),
    analyticsService.getCompanyBreakdown(companyCtx.monthStart, companyCtx.monthEnd),
    analyticsService.getRecentExpenses(5),
  ]);

  ApiResponse.success(res, {
    kpis,
    trends: trends.map((t) => ({
      label: `${t._id.month}/${t._id.year}`,
      total: t.total,
      count: t.count,
    })),
    expenseTypes: expenseTypes.map((e) => ({ name: e._id, value: e.total, count: e.count })),
    paymentMethods: paymentMethods.map((p) => ({ name: p._id, value: p.total })),
    headAnalytics: headAnalytics.map((h) => ({ name: h._id, value: h.total })),
    quarterly: quarterly.map((q) => ({ quarter: q._id, total: q.total, count: q.count })),
    companyChart: companyBreakdown,
    recentEntries,
    fyMonthOptions: companyCtx.fyMonthOptions,
    fyLabel: companyCtx.fyLabel,
    selectedMonths: {
      company: companyCtx.selectedMonth,
      expenseTypes: expenseTypesCtx.selectedMonth,
      paymentMethods: paymentMethodsCtx.selectedMonth,
      head: headCtx.selectedMonth,
    },
  });
});
