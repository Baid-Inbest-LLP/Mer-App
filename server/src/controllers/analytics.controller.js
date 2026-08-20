import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analytics.service.js';

const monthQueryFromParam = (month, financialYear) => {
  const ctx = analyticsService.getFyMonthContext(month, financialYear);
  return {
    ctx,
    query: {
      invoiceDateFrom: ctx.monthStart.toISOString(),
      invoiceDateTo: ctx.monthEnd.toISOString(),
      financialYear: ctx.financialYear,
    },
  };
};

export const getTrends = asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months, 10) || 12;
  const pack = await analyticsService.getExpenseTrends(months, req.query.financialYear);
  ApiResponse.success(res, {
    financialYear: pack.financialYear,
    data: pack.data,
  });
});

export const getHeadAnalytics = asyncHandler(async (req, res) => {
  const { ctx, query } = monthQueryFromParam(req.query.month, req.query.financialYear);
  const data = await analyticsService.getHeadOfExpenseAnalytics(query);
  ApiResponse.success(res, {
    selectedMonth: ctx.selectedMonth,
    financialYear: ctx.financialYear,
    fyMonthOptions: ctx.fyMonthOptions,
    data: data.map((h) => ({ name: h._id, value: h.total })),
  });
});

export const getExpenseTypes = asyncHandler(async (req, res) => {
  const { ctx, query } = monthQueryFromParam(req.query.month, req.query.financialYear);
  const data = await analyticsService.getExpenseTypeBreakdown(query);
  ApiResponse.success(res, {
    selectedMonth: ctx.selectedMonth,
    financialYear: ctx.financialYear,
    fyMonthOptions: ctx.fyMonthOptions,
    data: data.map((e) => ({ name: e._id, value: e.total, count: e.count })),
  });
});

export const getPaymentMethods = asyncHandler(async (req, res) => {
  const { ctx, query } = monthQueryFromParam(req.query.month, req.query.financialYear);
  const data = await analyticsService.getPaymentMethodBreakdown(query);
  ApiResponse.success(res, {
    selectedMonth: ctx.selectedMonth,
    financialYear: ctx.financialYear,
    fyMonthOptions: ctx.fyMonthOptions,
    data: data.map((p) => ({ name: p._id, value: p.total })),
  });
});

export const getCompanyChart = asyncHandler(async (req, res) => {
  const { ctx } = monthQueryFromParam(req.query.month, req.query.financialYear);
  const data = await analyticsService.getCompanyBreakdown(ctx.monthStart, ctx.monthEnd);
  ApiResponse.success(res, {
    selectedMonth: ctx.selectedMonth,
    financialYear: ctx.financialYear,
    fyMonthOptions: ctx.fyMonthOptions,
    data,
  });
});

export const getQuarterly = asyncHandler(async (req, res) => {
  const data = await analyticsService.getQuarterlyOverview(req.query.financialYear, req.query);
  ApiResponse.success(
    res,
    data.map((q) => ({
      quarter: q._id,
      total: q.total,
      net: q.net,
      gst: q.gst,
      outstanding: q.outstanding,
      amountPaid: q.amountPaid,
      count: q.count,
    })),
  );
});

export const getFYComparison = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 5;
  const data = await analyticsService.getFinancialYearComparison(
    req.query.financialYear,
    limit,
    req.query,
  );
  ApiResponse.success(
    res,
    data.map((f) => ({
      year: f._id,
      net: f.net,
      gst: f.gst,
      tds: f.tds,
      gross: f.gross,
      total: f.total,
      outstanding: f.outstanding,
      amountPaid: f.amountPaid,
      count: f.count,
    })),
  );
});

export const getDaysToClear = asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months, 10) || 12;
  const pack = await analyticsService.getAvgDaysToClearByMonth(months, req.query.financialYear);
  ApiResponse.success(res, {
    financialYear: pack.financialYear,
    data: pack.data,
  });
});
