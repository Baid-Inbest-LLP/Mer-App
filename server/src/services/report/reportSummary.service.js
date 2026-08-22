import { OPEN_PAYMENT_STATUSES } from '../../constants/paymentStatus.js';
import { Expense } from '../../models/Expense.js';
import { buildExpenseQuery } from '../../utils/queryBuilder.js';
import { normalizeReportScope, REPORT_SCOPE } from '../../utils/reportScope.js';
import {
  baseMatch,
  DUE_BUCKETS,
  startOfDay,
  endOfDay,
  dueAgingSwitch,
  REPORT_MONEY_GROUP,
} from './reportShared.js';

export const getReportSummary = async (query) => {
  const filter = buildExpenseQuery(query);
  const match = baseMatch(filter);
  const isExpenses = normalizeReportScope(query.reportScope) === REPORT_SCOPE.EXPENSES;
  const billsMatch = isExpenses
    ? baseMatch(buildExpenseQuery({ ...query, reportScope: REPORT_SCOPE.DUE }))
    : match;

  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const in7 = endOfDay(new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000));
  const monthEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0));

  const [facetRows, vendorCount, cashPaidRows] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalNet: { $sum: '$netAmount' },
                totalGST: { $sum: '$totalGST' },
                totalTDS: { $sum: '$tds' },
                grossAmount: { $sum: '$grossAmount' },
                outstanding: { $sum: '$balanceDue' },
                amountPaid: { $sum: '$amountPaid' },
                dueAndOverdue: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', OPEN_PAYMENT_STATUSES] },
                      '$balanceDue',
                      0,
                    ],
                  },
                },
                openCount: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', OPEN_PAYMENT_STATUSES] },
                      1,
                      0,
                    ],
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
          byBucket: [
            {
              $group: {
                _id: dueAgingSwitch(todayStart, todayEnd, in7, monthEnd),
                outstanding: { $sum: '$balanceDue' },
                amountPaid: { $sum: '$amountPaid' },
                gross: { $sum: '$grossAmount' },
                count: { $sum: 1 },
              },
            },
          ],
          dueThisMonth: [
            {
              $match: {
                status: { $in: OPEN_PAYMENT_STATUSES },
                dueDate: { $gte: todayStart, $lte: monthEnd },
              },
            },
            {
              $group: {
                _id: null,
                outstanding: { $sum: '$balanceDue' },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$vendor' } },
      { $count: 'vendors' },
    ]),
    isExpenses
      ? Expense.aggregate([
          { $match: billsMatch },
          { $group: { _id: null, amountPaid: { $sum: '$amountPaid' } } },
        ])
      : Promise.resolve([]),
  ]);

  const facet = facetRows[0] || {};
  const totals = facet.totals?.[0] || {};
  const bucketMap = Object.fromEntries(
    (facet.byBucket || []).map((row) => [row._id, row]),
  );
  const buckets = DUE_BUCKETS.map((meta) => {
    const row = bucketMap[meta.key] || {};
    return {
      key: meta.key,
      name: meta.name,
      value: meta.key === 'paid' ? (row.gross || row.amountPaid || 0) : (row.outstanding || 0),
      count: row.count || 0,
    };
  });

  const cashPaid = cashPaidRows[0]?.amountPaid;
  // Expense Gross = money actually paid on the same bills (incl. partials),
  // matching the Bills "Paid" card — not only fully-settled invoice gross.
  const grossAmount = isExpenses
    ? (cashPaid || 0)
    : (totals.grossAmount || 0);

  return {
    totalNetAmount: totals.totalNet || 0,
    totalGST: totals.totalGST || 0,
    totalTDS: totals.totalTDS || 0,
    grossAmount,
    outstanding: totals.outstanding || 0,
    amountPaid: isExpenses ? (cashPaid || 0) : (totals.amountPaid || 0),
    dueAndOverdue: totals.dueAndOverdue || 0,
    openCount: totals.openCount || 0,
    entryCount: totals.count || 0,
    vendorCount: vendorCount[0]?.vendors || 0,
    overdue: buckets.find((b) => b.key === 'overdue')?.value || 0,
    dueToday: buckets.find((b) => b.key === 'due_today')?.value || 0,
    dueIn7: buckets.find((b) => b.key === 'due_7')?.value || 0,
    dueThisMonth: facet.dueThisMonth?.[0]?.outstanding || 0,
    buckets,
  };
};

export const getExpenseHeadSummary = async (query) => {
  const filter = buildExpenseQuery(query);
  return Expense.aggregate([
    { $match: baseMatch(filter) },
    {
      $group: {
        _id: '$headOfExpense',
        ...REPORT_MONEY_GROUP,
      },
    },
    { $sort: { outstanding: -1, gross: -1 } },
  ]);
};
