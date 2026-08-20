import { Expense } from '../models/Expense.js';
import { ExpensePayment } from '../models/ExpensePayment.js';
import { Company } from '../models/Company.js';
import { buildExpenseQuery } from '../utils/queryBuilder.js';
import { applyReportScope } from '../utils/reportScope.js';
import { getFinancialYear } from '../config/index.js';
import { OPEN_PAYMENT_STATUSES, PAYMENT_STATUS } from '../constants/paymentStatus.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');

export const getFyMonthContext = (requestedMonth = '', financialYear = '') => {
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const currentFyStartYear = monthIdx >= 3 ? year : year - 1;

  const requestedFy = String(financialYear || '').trim();
  const parsedFyStart = parseInt(requestedFy.split('-')[0], 10);
  const fyStartYear = Number.isFinite(parsedFyStart) && parsedFyStart > 2000
    ? parsedFyStart
    : currentFyStartYear;
  const fyLabel = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;

  const fyMonths = [];
  for (let m = 4; m <= 12; m += 1) fyMonths.push({ year: fyStartYear, month: m });
  for (let m = 1; m <= 3; m += 1) fyMonths.push({ year: fyStartYear + 1, month: m });

  const fyMonthOptions = fyMonths.map(({ year: y, month: m }) => ({
    value: `${y}-${pad2(m)}`,
    label: MONTH_NAMES[m - 1],
  }));

  const defaultMonth = `${year}-${pad2(monthIdx + 1)}`;
  let selectedMonth = fyMonthOptions[0]?.value;
  if (fyMonthOptions.some((o) => o.value === requestedMonth)) {
    selectedMonth = requestedMonth;
  } else if (fyMonthOptions.some((o) => o.value === defaultMonth)) {
    selectedMonth = defaultMonth;
  } else if (fyStartYear < currentFyStartYear) {
    selectedMonth = fyMonthOptions[fyMonthOptions.length - 1]?.value;
  }

  const [selY, selM] = (selectedMonth || '').split('-').map((v) => parseInt(v, 10));
  const monthStart = new Date(selY, (selM || 1) - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(selY, selM || 1, 0, 23, 59, 59, 999);

  return {
    fyMonthOptions,
    selectedMonth,
    monthStart,
    monthEnd,
    fyLabel,
    financialYear: fyLabel,
  };
};

/** Calendar slots for an Indian FY (Apr–Mar), oldest → newest. */
export const getFyMonthSlots = (financialYear = '') => {
  const ctx = getFyMonthContext('', financialYear);
  const [startYear] = String(ctx.financialYear).split('-').map(Number);
  const slots = [];
  for (let m = 4; m <= 12; m += 1) {
    slots.push({
      year: startYear,
      month: m,
      label: `${MONTH_NAMES[m - 1]} ${String(startYear).slice(-2)}`,
    });
  }
  for (let m = 1; m <= 3; m += 1) {
    slots.push({
      year: startYear + 1,
      month: m,
      label: `${MONTH_NAMES[m - 1]} ${String(startYear + 1).slice(-2)}`,
    });
  }
  return { financialYear: ctx.financialYear, slots };
};

const baseMatch = (extra = {}) => ({
  isDraft: { $ne: true },
  status: { $ne: 'Cancelled' },
  approvalStatus: 'Approved',
  ...extra,
});

const previousFinancialYearLabel = (fy) => {
  const startYear = parseInt(String(fy || '').split('-')[0], 10);
  if (!startYear) return '';
  return `${startYear - 1}-${String(startYear).slice(-2)}`;
};

const pctChange = (current, previous) => {
  if (!(previous > 0)) return 0;
  return Math.round((((current - previous) / previous) * 100) * 100) / 100;
};

export const getDashboardKPIs = async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fy = getFinancialYear(now);
  const prevFy = previousFinancialYearLabel(fy);
  const [startYear] = fy.split('-').map(Number);
  const fyStart = new Date(startYear, 3, 1);
  const fyEnd = new Date(startYear + 1, 3, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const paidMatch = { ...baseMatch(), status: PAYMENT_STATUS.PAID };
  const openMatch = {
    ...baseMatch(),
    status: { $in: OPEN_PAYMENT_STATUSES },
    balanceDue: { $gt: 0 },
  };

  const [
    fyBillingAgg,
    fyExpenseAgg,
    prevFyExpenseAgg,
    thisMonthExpenseAgg,
    lastMonthExpenseAgg,
    fyPaidOnBillsAgg,
    paidThisMonthAgg,
    paidThisFYAgg,
    overdueAgg,
    pendingPaymentAgg,
    pendingApprovals,
    totals,
  ] = await Promise.all([
    // All approved bills this FY (paid + unpaid), excl. cancelled.
    Expense.aggregate([
      { $match: { ...baseMatch(), financialYear: fy } },
      {
        $group: {
          _id: null,
          gross: { $sum: '$grossAmount' },
          amountPaid: { $sum: '$amountPaid' },
        },
      },
    ]),
    // Fully paid expenses this FY (invoice gross).
    Expense.aggregate([
      { $match: { ...paidMatch, financialYear: fy } },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { ...paidMatch, financialYear: prevFy } },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { ...paidMatch, invoiceDate: { $gte: thisMonthStart } } },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]),
    Expense.aggregate([
      {
        $match: {
          ...paidMatch,
          invoiceDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
        },
      },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]),
    // Amount recorded as paid against FY bills (incl. partials) — for collection rate.
    Expense.aggregate([
      { $match: { ...baseMatch(), financialYear: fy } },
      { $group: { _id: null, amountPaid: { $sum: '$amountPaid' } } },
    ]),
    ExpensePayment.aggregate([
      { $match: { status: 'Active', paymentDate: { $gte: thisMonthStart } } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]),
    ExpensePayment.aggregate([
      { $match: { status: 'Active', paymentDate: { $gte: fyStart, $lt: fyEnd } } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      {
        $match: {
          ...openMatch,
          dueDate: { $ne: null, $lt: todayStart },
        },
      },
      { $group: { _id: null, balance: { $sum: '$balanceDue' } } },
    ]),
    Expense.aggregate([
      { $match: openMatch },
      {
        $group: {
          _id: null,
          balance: { $sum: '$balanceDue' },
          count: { $sum: 1 },
        },
      },
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

  const fyBillingAmount = fyBillingAgg[0]?.gross || 0;
  const fyExpense = fyExpenseAgg[0]?.gross || 0;
  const prevFyExpense = prevFyExpenseAgg[0]?.gross || 0;
  const thisMonthExpense = thisMonthExpenseAgg[0]?.gross || 0;
  const lastMonthExpense = lastMonthExpenseAgg[0]?.gross || 0;
  const fyAmountPaid = fyPaidOnBillsAgg[0]?.amountPaid || fyBillingAgg[0]?.amountPaid || 0;
  const collectionRate = fyBillingAmount > 0
    ? Math.round(((fyAmountPaid / fyBillingAmount) * 100) * 100) / 100
    : 0;

  return {
    fyBillingAmount,
    financialYearExpense: fyExpense,
    yearlyExpenseChange: pctChange(fyExpense, prevFyExpense),
    monthlyExpenseChange: pctChange(thisMonthExpense, lastMonthExpense),
    collectionRate,
    thisMonthExpense,
    paidThisMonth: paidThisMonthAgg[0]?.paid || 0,
    paidThisFY: paidThisFYAgg[0]?.paid || 0,
    overdue: overdueAgg[0]?.balance || 0,
    pendingPayment: pendingPaymentAgg[0]?.count || 0,
    pendingApprovals,
    // Legacy aliases kept for older clients / charts.
    pendingEntries: pendingApprovals,
    outstanding: pendingPaymentAgg[0]?.balance || 0,
    totalGST: totals[0]?.totalGST || 0,
    totalTDS: totals[0]?.totalTDS || 0,
    grossAmount: totals[0]?.grossAmount || 0,
    currentFinancialYear: fy,
  };
};

export const getExpenseTrends = async (months = 12, financialYear = '') => {
  if (financialYear) {
    const { financialYear: fy, slots } = getFyMonthSlots(financialYear);
    const rows = await Expense.aggregate([
      { $match: { ...baseMatch(), financialYear: fy } },
      {
        $group: {
          _id: { year: { $year: '$invoiceDate' }, month: { $month: '$invoiceDate' } },
          total: { $sum: '$grossAmount' },
          count: { $sum: 1 },
        },
      },
    ]);
    const byKey = Object.fromEntries(
      rows.map((r) => [`${r._id.year}-${r._id.month}`, r]),
    );
    return {
      financialYear: fy,
      data: slots.map((slot) => {
        const row = byKey[`${slot.year}-${slot.month}`];
        return {
          label: slot.label,
          total: row?.total || 0,
          count: row?.count || 0,
        };
      }),
    };
  }

  const start = new Date();
  start.setMonth(start.getMonth() - months);

  const rows = await Expense.aggregate([
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

  return {
    financialYear: '',
    data: rows.map((t) => ({
      label: `${t._id.month}/${t._id.year}`,
      total: t.total,
      count: t.count,
    })),
  };
};

/**
 * Average calendar days from due date (fallback: invoice date) to full
 * payment, grouped by the month the bill was due. Empty months stay in
 * the series so the chart remains continuous.
 */
export const getAvgDaysToClearByMonth = async (months = 12, financialYear = '') => {
  let monthSlots;
  let rangeStart;
  let rangeEnd = null;
  let fyLabel = '';

  if (financialYear) {
    const packed = getFyMonthSlots(financialYear);
    fyLabel = packed.financialYear;
    monthSlots = packed.slots;
    const first = monthSlots[0];
    const last = monthSlots[monthSlots.length - 1];
    rangeStart = new Date(first.year, first.month - 1, 1, 0, 0, 0, 0);
    rangeEnd = new Date(last.year, last.month, 0, 23, 59, 59, 999);
  } else {
    const now = new Date();
    rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1, 0, 0, 0, 0);
    monthSlots = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthSlots.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      });
    }
  }

  const rows = await Expense.aggregate([
    {
      $match: {
        isDraft: { $ne: true },
        status: 'Paid',
      },
    },
    {
      $addFields: {
        anchorDate: { $ifNull: ['$dueDate', '$invoiceDate'] },
        clearDate: { $ifNull: ['$clearedAt', '$paymentDate'] },
      },
    },
    {
      $match: {
        anchorDate: {
          $gte: rangeStart,
          ...(rangeEnd ? { $lte: rangeEnd } : {}),
          $ne: null,
        },
        clearDate: { $ne: null },
      },
    },
    {
      $addFields: {
        resolvedDays: {
          $cond: [
            { $and: [{ $ne: ['$daysToClear', null] }, { $ne: [{ $type: '$daysToClear' }, 'missing'] }] },
            '$daysToClear',
            {
              $dateDiff: {
                startDate: { $dateTrunc: { date: '$anchorDate', unit: 'day' } },
                endDate: { $dateTrunc: { date: '$clearDate', unit: 'day' } },
                unit: 'day',
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$anchorDate' },
          month: { $month: '$anchorDate' },
        },
        avgDays: { $avg: '$resolvedDays' },
        count: { $sum: 1 },
      },
    },
  ]);

  const byKey = Object.fromEntries(
    rows.map((r) => [`${r._id.year}-${r._id.month}`, r]),
  );

  return {
    financialYear: fyLabel,
    data: monthSlots.map((slot) => {
      const row = byKey[`${slot.year}-${slot.month}`];
      return {
        label: slot.label,
        avgDays: row ? Math.round(row.avgDays * 10) / 10 : null,
        count: row?.count || 0,
      };
    }),
  };
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

export const getQuarterlyOverview = async (financialYear, query = {}) => {
  const scopeFilter = {};
  applyReportScope(scopeFilter, query.reportScope);
  const match = {
    ...baseMatch(scopeFilter),
    ...(financialYear ? { financialYear } : {}),
  };

  return Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$quarter',
        total: { $sum: '$grossAmount' },
        net: { $sum: '$netAmount' },
        gst: { $sum: '$totalGST' },
        outstanding: { $sum: '$balanceDue' },
        amountPaid: { $sum: '$amountPaid' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

export const getFinancialYearComparison = async (anchorFy, limit = 5, query = {}) => {
  const scopeFilter = {};
  applyReportScope(scopeFilter, query.reportScope);
  const rows = await Expense.aggregate([
    { $match: baseMatch(scopeFilter) },
    {
      $group: {
        _id: '$financialYear',
        net: { $sum: '$netAmount' },
        gst: { $sum: '$totalGST' },
        tds: { $sum: '$tds' },
        gross: { $sum: '$grossAmount' },
        total: { $sum: '$grossAmount' },
        outstanding: { $sum: '$balanceDue' },
        amountPaid: { $sum: '$amountPaid' },
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
  Expense.find({
    isDraft: { $ne: true },
    status: { $ne: 'Cancelled' },
  })
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
