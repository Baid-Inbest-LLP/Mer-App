import { Expense } from '../models/Expense.js';
import { OPEN_PAYMENT_STATUSES, PAYMENT_STATUS } from '../constants/paymentStatus.js';
import { buildExpenseQuery, buildPagination, buildSort } from '../utils/queryBuilder.js';

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

/**
 * Due Expenses board: open obligations (Pending / PartiallyPaid / Hold),
 * optionally filtered by aging bucket and nature.
 */
export const getDueExpenses = async (query = {}) => {
  const { page, limit, skip } = buildPagination(query);
  const sort = buildSort(query, { dueDate: 1, invoiceDate: 1 });

  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const in7 = endOfDay(addDays(todayStart, 7));
  const monthEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0));

  // Reuse the shared expense filter builder so the Due board supports the same
  // filters as the main list (search, financial year, month, expense type,
  // payment method, head of expense, company, location, etc.). The payment
  // status and open-balance scope are always enforced by the Due board itself.
  const baseQuery = { ...query };
  delete baseQuery.status;
  delete baseQuery.bucket;
  delete baseQuery.openBalance;

  const filter = buildExpenseQuery(baseQuery);
  filter.isDraft = { $ne: true };
  filter.status = { $in: OPEN_PAYMENT_STATUSES };
  filter.balanceDue = { $gt: 0 };

  const bucket = String(query.bucket || 'all').toLowerCase();
  switch (bucket) {
    case 'overdue':
      filter.dueDate = { $lt: todayStart };
      break;
    case 'due_today':
      filter.dueDate = { $gte: todayStart, $lte: todayEnd };
      break;
    case 'due_7':
      filter.dueDate = { $gte: todayStart, $lte: in7 };
      break;
    case 'due_month':
      filter.dueDate = { $gte: todayStart, $lte: monthEnd };
      break;
    case 'partial':
      filter.status = PAYMENT_STATUS.PARTIALLY_PAID;
      break;
    case 'hold':
      filter.status = PAYMENT_STATUS.HOLD;
      break;
    default:
      break;
  }

  const [expenses, total, summary] = await Promise.all([
    Expense.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      {
        $match: filter,
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                balanceDue: { $sum: '$balanceDue' },
                grossAmount: { $sum: '$grossAmount' },
                amountPaid: { $sum: '$amountPaid' },
              },
            },
          ],
          byNature: [
            {
              $group: {
                _id: '$expenseNature',
                count: { $sum: 1 },
                balanceDue: { $sum: '$balanceDue' },
              },
            },
          ],
          byBucket: [
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $lt: ['$dueDate', todayStart] }, then: 'overdue' },
                      {
                        case: {
                          $and: [
                            { $gte: ['$dueDate', todayStart] },
                            { $lte: ['$dueDate', todayEnd] },
                          ],
                        },
                        then: 'due_today',
                      },
                      {
                        case: {
                          $and: [
                            { $gt: ['$dueDate', todayEnd] },
                            { $lte: ['$dueDate', in7] },
                          ],
                        },
                        then: 'due_7',
                      },
                      {
                        case: {
                          $and: [
                            { $gt: ['$dueDate', in7] },
                            { $lte: ['$dueDate', monthEnd] },
                          ],
                        },
                        then: 'due_month',
                      },
                    ],
                    default: 'later',
                  },
                },
                count: { $sum: 1 },
                balanceDue: { $sum: '$balanceDue' },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const facet = summary[0] || {};
  const totals = facet.totals?.[0] || {
    count: 0,
    balanceDue: 0,
    grossAmount: 0,
    amountPaid: 0,
  };

  return {
    expenses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
    summary: {
      totals,
      byNature: facet.byNature || [],
      byBucket: facet.byBucket || [],
    },
  };
};
