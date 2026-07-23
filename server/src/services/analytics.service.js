import { Expense } from '../models/Expense.js';
import { Company } from '../models/Company.js';
import { buildExpenseQuery } from '../utils/queryBuilder.js';
import { getFinancialYear } from '../config/index.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');

export const getFyMonthContext = (requestedMonth = '') => {
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const fyStartYear = monthIdx >= 3 ? year : year - 1;

  const fyMonths = [];
  for (let m = 4; m <= 12; m += 1) fyMonths.push({ year: fyStartYear, month: m });
  for (let m = 1; m <= 3; m += 1) fyMonths.push({ year: fyStartYear + 1, month: m });

  const fyMonthOptions = fyMonths.map(({ year: y, month: m }) => ({
    value: `${y}-${pad2(m)}`,
    label: MONTH_NAMES[m - 1],
  }));

  const defaultMonth = `${year}-${pad2(monthIdx + 1)}`;
  const selectedMonth = fyMonthOptions.some((o) => o.value === requestedMonth)
    ? requestedMonth
    : fyMonthOptions.some((o) => o.value === defaultMonth)
      ? defaultMonth
      : fyMonthOptions[0]?.value;

  const [selY, selM] = (selectedMonth || '').split('-').map((v) => parseInt(v, 10));
  const monthStart = new Date(selY, (selM || 1) - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(selY, selM || 1, 0, 23, 59, 59, 999);

  return {
    fyMonthOptions,
    selectedMonth,
    monthStart,
    monthEnd,
    fyLabel: `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
  };
};

const baseMatch = (extra = {}) => ({
  isDraft: { $ne: true },
  status: { $ne: 'Cancelled' },
  approvalStatus: 'Approved',
  ...extra,
});

export const getDashboardKPIs = async () => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fy = getFinancialYear(now);
  const [startYear] = fy.split('-').map(Number);
  const fyStart = new Date(startYear, 3, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [thisMonth, lastMonth, fyTotal, pendingCount, totals] = await Promise.all([
    Expense.aggregate([
      { $match: { ...baseMatch(), invoiceDate: { $gte: thisMonthStart } } },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]),
    Expense.aggregate([
      {
        $match: {
          ...baseMatch(),
          invoiceDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
        },
      },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { ...baseMatch(), financialYear: fy } },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]),
    Expense.countDocuments({
      isDraft: { $ne: true },
      approvalStatus: 'Pending',
    }),
    Expense.aggregate([
      { $match: baseMatch() },
      {
        $group: {
          _id: null,
          totalGST: { $sum: '$totalGST' },
          totalTDS: { $sum: '$tds' },
          grossAmount: { $sum: '$grossAmount' },
        },
      },
    ]),
  ]);

  const thisMonthExpense = thisMonth[0]?.gross || 0;
  const lastMonthExpense = lastMonth[0]?.gross || 0;
  const monthlyChange =
    lastMonthExpense > 0
      ? ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100
      : 0;

  return {
    thisMonthExpense,
    financialYearExpense: fyTotal[0]?.gross || 0,
    monthlyExpenseChange: Math.round(monthlyChange * 100) / 100,
    pendingEntries: pendingCount,
    totalGST: totals[0]?.totalGST || 0,
    totalTDS: totals[0]?.totalTDS || 0,
    grossAmount: totals[0]?.grossAmount || 0,
    currentFinancialYear: fy,
  };
};

export const getExpenseTrends = async (months = 12) => {
  const start = new Date();
  start.setMonth(start.getMonth() - months);

  return Expense.aggregate([
    { $match: { ...baseMatch(), invoiceDate: { $gte: start } } },
    {
      $group: {
        _id: { year: { $year: '$invoiceDate' }, month: { $month: '$invoiceDate' } },
        total: { $sum: '$grossAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
};

export const getExpenseTypeBreakdown = async (query = {}) => {
  const filter = buildExpenseQuery(query);
  return Expense.aggregate([
    { $match: { ...filter, ...baseMatch() } },
    {
      $group: {
        _id: '$expenseType',
        total: { $sum: '$grossAmount' },
        count: { $sum: 1 },
      },
    },
  ]);
};

export const getPaymentMethodBreakdown = async (query = {}) => {
  const filter = buildExpenseQuery(query);
  return Expense.aggregate([
    { $match: { ...filter, ...baseMatch() } },
    {
      $group: {
        _id: '$paymentMethod',
        total: { $sum: '$grossAmount' },
        count: { $sum: 1 },
      },
    },
  ]);
};

export const getHeadOfExpenseAnalytics = async (query = {}) => {
  const filter = buildExpenseQuery(query);
  return Expense.aggregate([
    { $match: { ...filter, ...baseMatch() } },
    {
      $group: {
        _id: '$headOfExpense',
        total: { $sum: '$grossAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 15 },
  ]);
};

export const getQuarterlyOverview = async (financialYear) => {
  const match = financialYear
    ? { ...baseMatch(), financialYear }
    : baseMatch();

  return Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$quarter',
        total: { $sum: '$grossAmount' },
        net: { $sum: '$netAmount' },
        gst: { $sum: '$totalGST' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

export const getFinancialYearComparison = async (anchorFy, limit = 5) => {
  const rows = await Expense.aggregate([
    { $match: baseMatch() },
    {
      $group: {
        _id: '$financialYear',
        net: { $sum: '$netAmount' },
        gst: { $sum: '$totalGST' },
        tds: { $sum: '$tds' },
        gross: { $sum: '$grossAmount' },
        total: { $sum: '$grossAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  if (!anchorFy) return rows.slice(0, limit);

  const idx = rows.findIndex((row) => row._id === anchorFy);
  if (idx === -1) return rows.slice(0, limit);

  return rows.slice(idx, idx + limit);
};

export const getRecentExpenses = async (limit = 5) =>
  Expense.find({ isDraft: { $ne: true } })
    .select(
      'slNo month invoiceDate company coNames headOfExpense grossAmount approvalStatus status createdAt',
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

export const getCompanyBreakdown = async (monthStart, monthEnd) => {
  const [rows, companies] = await Promise.all([
    Expense.aggregate([
      { $match: { ...baseMatch(), invoiceDate: { $gte: monthStart, $lte: monthEnd } } },
      {
        $group: {
          _id: '$company',
          total: { $sum: '$grossAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Company.find({ isActive: { $ne: false } })
      .select('name code')
      .sort({ code: 1 })
      .lean(),
  ]);

  const totalsByName = Object.fromEntries(
    rows.filter((r) => r._id).map((r) => [r._id, { total: r.total, count: r.count }]),
  );

  return companies.map((company) => {
    const stats = totalsByName[company.name] || { total: 0, count: 0 };
    return {
      name: company.code || company.name,
      value: stats.total,
      count: stats.count,
    };
  });
};
