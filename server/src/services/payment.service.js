import { Expense } from '../models/Expense.js';
import { ExpensePayment } from '../models/ExpensePayment.js';
import { ApiError } from '../utils/ApiError.js';
import {
  MONEY_EPSILON,
  PAYMENT_STATUS,
  roundMoney,
} from '../constants/paymentStatus.js';
import {
  requiresBankAccount,
  requiresCardNumber,
  requiresPaymentRef,
} from '../constants/paymentMethods.js';
import { isAdminRole } from '../constants/roles.js';

const asTrimmed = (value) => {
  if (value == null || value === '') return '';
  return String(value).trim();
};

const creatorId = (expense) =>
  expense.createdBy?._id?.toString() || expense.createdBy?.toString();

export const canManagePayments = (expense, user) => {
  if (!user?._id) return false;
  if (isAdminRole(user.role)) return true;
  return creatorId(expense) === user._id.toString();
};

const assertCanManagePayments = (expense, user) => {
  if (!canManagePayments(expense, user)) {
    throw ApiError.forbidden('You do not have permission to manage payments for this entry');
  }
};

const validatePaymentInstrument = (data) => {
  const method = asTrimmed(data.paymentMethod);
  if (!method) throw ApiError.badRequest('Payment method is required');

  if (requiresBankAccount(method) && !asTrimmed(data.bankAccountNumber)) {
    throw ApiError.badRequest('From account is required for the selected payment method');
  }
  if (requiresPaymentRef(method) && !asTrimmed(data.paymentRefNumber)) {
    throw ApiError.badRequest('Payment reference is required for the selected payment method');
  }
  if (requiresCardNumber(method) && !asTrimmed(data.cardNumber)) {
    throw ApiError.badRequest('Card number is required for the selected payment method');
  }
};

const resolveStatusFromBalance = ({ amountPaid, balanceDue, currentStatus }) => {
  if (currentStatus === PAYMENT_STATUS.CANCELLED) return PAYMENT_STATUS.CANCELLED;
  if (balanceDue <= MONEY_EPSILON) return PAYMENT_STATUS.PAID;
  if (currentStatus === PAYMENT_STATUS.HOLD) return PAYMENT_STATUS.HOLD;
  if (amountPaid > MONEY_EPSILON) return PAYMENT_STATUS.PARTIALLY_PAID;
  return PAYMENT_STATUS.PENDING;
};

/**
 * Recompute cached payment totals + status from active payment rows.
 * Mirrors latest payment fields onto the expense for reports/list views.
 */
export const recalculateExpensePaymentState = async (expenseId, { preserveHold = true } = {}) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found');

  const payments = await ExpensePayment.find({ expenseId, status: 'Active' })
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  const amountPaid = roundMoney(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
  const gross = roundMoney(expense.grossAmount || 0);
  const balanceDue = roundMoney(Math.max(0, gross - amountPaid));

  const currentStatus = expense.status;
  let nextStatus = resolveStatusFromBalance({
    amountPaid,
    balanceDue,
    currentStatus: preserveHold ? currentStatus : (
      currentStatus === PAYMENT_STATUS.HOLD ? PAYMENT_STATUS.PENDING : currentStatus
    ),
  });

  // Fully cleared bills leave Hold automatically.
  if (balanceDue <= MONEY_EPSILON && currentStatus !== PAYMENT_STATUS.CANCELLED) {
    nextStatus = PAYMENT_STATUS.PAID;
  }

  expense.amountPaid = amountPaid;
  expense.balanceDue = balanceDue;
  expense.status = nextStatus;

  const latest = payments[0];
  if (latest) {
    expense.paymentDate = latest.paymentDate;
    expense.paymentMethod = latest.paymentMethod;
    expense.paymentRefNumber = latest.paymentRefNumber || '';
    expense.bankAccountNumber = latest.bankAccountNumber || '';
    expense.cardNumber = latest.cardNumber || '';
    if (latest.merType) expense.merType = latest.merType;
  } else if (nextStatus === PAYMENT_STATUS.PENDING || nextStatus === PAYMENT_STATUS.HOLD) {
    // Keep preferred method/merType; clear settlement mirrors when no payments remain.
    expense.paymentDate = undefined;
    expense.paymentRefNumber = '';
  }

  await expense.save();
  return expense;
};

export const listPaymentsForExpense = async (expenseId) => {
  const expense = await Expense.findById(expenseId).select('_id').lean();
  if (!expense) throw ApiError.notFound('Expense not found');

  return ExpensePayment.find({ expenseId })
    .sort({ paymentDate: -1, createdAt: -1 })
    .populate('createdBy', 'name email')
    .populate('voidedBy', 'name email')
    .lean();
};

export const addPayment = async (expenseId, data, user) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.isDraft) throw ApiError.badRequest('Submit the entry before recording payments');
  if (expense.status === PAYMENT_STATUS.CANCELLED) {
    throw ApiError.badRequest('Cannot record payments on a cancelled expense');
  }

  assertCanManagePayments(expense, user);
  validatePaymentInstrument(data);

  // Ensure balances are current before accepting a new part.
  await recalculateExpensePaymentState(expense._id);
  const fresh = await Expense.findById(expenseId);
  const balanceDue = roundMoney(fresh.balanceDue ?? fresh.grossAmount ?? 0);
  const amount = roundMoney(data.amount);

  if (!(amount > 0)) throw ApiError.badRequest('Payment amount must be greater than zero');
  if (amount > balanceDue + MONEY_EPSILON) {
    throw ApiError.badRequest(
      `Payment amount (₹${amount}) exceeds balance due (₹${balanceDue})`,
    );
  }

  const merType =
    asTrimmed(data.merType)
    || fresh.merType
    || (data.paymentMethod === 'Cash' ? 'Cash' : 'Bank');

  const payment = await ExpensePayment.create({
    expenseId: fresh._id,
    amount,
    paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
    paymentMethod: data.paymentMethod,
    paymentRefNumber: asTrimmed(data.paymentRefNumber),
    bankAccountNumber: asTrimmed(data.bankAccountNumber),
    cardNumber: asTrimmed(data.cardNumber),
    merType,
    notes: asTrimmed(data.notes),
    status: 'Active',
    createdBy: user._id,
  });

  const updatedExpense = await recalculateExpensePaymentState(fresh._id);
  const populated = await ExpensePayment.findById(payment._id)
    .populate('createdBy', 'name email')
    .lean();

  return { payment: populated, expense: updatedExpense };
};

export const voidPayment = async (expenseId, paymentId, user) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found');
  assertCanManagePayments(expense, user);

  const payment = await ExpensePayment.findOne({ _id: paymentId, expenseId });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'Voided') throw ApiError.badRequest('Payment is already voided');

  payment.status = 'Voided';
  payment.voidedBy = user._id;
  payment.voidedAt = new Date();
  await payment.save();

  const updatedExpense = await recalculateExpensePaymentState(expenseId);
  return { payment, expense: updatedExpense };
};

export const setHoldStatus = async (expenseId, hold, user) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.isDraft) throw ApiError.badRequest('Submit the entry before changing payment status');
  if (expense.status === PAYMENT_STATUS.CANCELLED) {
    throw ApiError.badRequest('Cancelled expenses cannot be put on hold');
  }
  if (expense.status === PAYMENT_STATUS.PAID) {
    throw ApiError.badRequest('Fully paid expenses cannot be put on hold');
  }

  assertCanManagePayments(expense, user);

  if (hold) {
    expense.status = PAYMENT_STATUS.HOLD;
    expense.updatedBy = user._id;
    await expense.save();
    return expense;
  }

  // Release hold → recompute Pending vs PartiallyPaid from ledger.
  expense.status = PAYMENT_STATUS.PENDING;
  expense.updatedBy = user._id;
  await expense.save();
  return recalculateExpensePaymentState(expenseId, { preserveHold: false });
};

export const cancelExpensePayment = async (expenseId, user) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found');
  assertCanManagePayments(expense, user);

  if (roundMoney(expense.amountPaid) > MONEY_EPSILON) {
    throw ApiError.badRequest('Void all payments before cancelling this expense');
  }

  expense.status = PAYMENT_STATUS.CANCELLED;
  expense.balanceDue = 0;
  expense.updatedBy = user._id;
  await expense.save();
  return expense;
};

/**
 * One-time backfill: Paid expenses without ledger rows get a synthetic payment;
 * all expenses get amountPaid / balanceDue / dueDate / expenseNature caches.
 * Uses bulk operations so large seed DBs finish quickly on startup.
 */
export const migratePaymentLedger = async () => {
  const MIGRATION_ID = 'payment-ledger-v1';
  const migrations = Expense.db.collection('migrations');

  const existing = await migrations.findOne({ _id: MIGRATION_ID });
  if (existing?.status === 'done') return;

  // Recover stuck lock from interrupted startups (older than 2 minutes).
  if (existing?.status === 'running') {
    const claimedAt = existing.claimedAt ? new Date(existing.claimedAt).getTime() : 0;
    if (Date.now() - claimedAt < 2 * 60 * 1000) return;
    await migrations.deleteOne({ _id: MIGRATION_ID });
  }

  try {
    await migrations.insertOne({
      _id: MIGRATION_ID,
      status: 'running',
      claimedAt: new Date(),
    });
  } catch (err) {
    if (err?.code === 11000) return;
    throw err;
  }

  try {
    // Backfill dueDate + nature in bulk.
    await Expense.updateMany(
      { dueDate: { $exists: false }, invoiceDate: { $exists: true } },
      [{ $set: { dueDate: '$invoiceDate' } }],
    );
    await Expense.updateMany(
      { expenseNature: { $exists: false } },
      { $set: { expenseNature: 'Variable' } },
    );

    // Create synthetic payments for Paid expenses that have none.
    const paidMissing = await Expense.aggregate([
      {
        $match: {
          status: PAYMENT_STATUS.PAID,
          isDraft: { $ne: true },
          grossAmount: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: 'expensepayments',
          let: { eid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$expenseId', '$$eid'] },
                    { $eq: ['$status', 'Active'] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'activePayments',
        },
      },
      { $match: { activePayments: { $size: 0 } } },
      {
        $project: {
          _id: 1,
          grossAmount: 1,
          paymentDate: 1,
          invoiceDate: 1,
          createdAt: 1,
          paymentMethod: 1,
          paymentRefNumber: 1,
          bankAccountNumber: 1,
          cardNumber: 1,
          merType: 1,
          createdBy: 1,
        },
      },
    ]);

    if (paidMissing.length) {
      await ExpensePayment.insertMany(
        paidMissing.map((expense) => ({
          expenseId: expense._id,
          amount: roundMoney(expense.grossAmount || 0),
          paymentDate: expense.paymentDate || expense.invoiceDate || expense.createdAt || new Date(),
          paymentMethod: expense.paymentMethod || 'Cash',
          paymentRefNumber: expense.paymentRefNumber || '',
          bankAccountNumber: expense.bankAccountNumber || '',
          cardNumber: expense.cardNumber || '',
          merType: expense.merType || (expense.paymentMethod === 'Cash' ? 'Cash' : 'Bank'),
          notes: 'Migrated from legacy single-payment fields',
          status: 'Active',
          createdBy: expense.createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        { ordered: false },
      );
    }

    // Aggregate paid totals and write caches in bulk.
    const paidTotals = await ExpensePayment.aggregate([
      { $match: { status: 'Active' } },
      {
        $group: {
          _id: '$expenseId',
          amountPaid: { $sum: '$amount' },
          lastPaymentDate: { $max: '$paymentDate' },
        },
      },
    ]);
    const paidMap = new Map(paidTotals.map((row) => [String(row._id), row]));

    const expenses = await Expense.find({})
      .select('_id grossAmount status amountPaid balanceDue')
      .lean();

    const ops = [];
    for (const expense of expenses) {
      const paidRow = paidMap.get(String(expense._id));
      const amountPaid = roundMoney(paidRow?.amountPaid || 0);
      const gross = roundMoney(expense.grossAmount || 0);
      const balanceDue = roundMoney(Math.max(0, gross - amountPaid));
      let status = expense.status;
      if (status !== PAYMENT_STATUS.CANCELLED && status !== PAYMENT_STATUS.HOLD) {
        if (balanceDue <= MONEY_EPSILON) status = PAYMENT_STATUS.PAID;
        else if (amountPaid > MONEY_EPSILON) status = PAYMENT_STATUS.PARTIALLY_PAID;
        else status = PAYMENT_STATUS.PENDING;
      } else if (status === PAYMENT_STATUS.HOLD && balanceDue <= MONEY_EPSILON) {
        status = PAYMENT_STATUS.PAID;
      }

      ops.push({
        updateOne: {
          filter: { _id: expense._id },
          update: {
            $set: {
              amountPaid,
              balanceDue,
              status,
              ...(paidRow?.lastPaymentDate ? { paymentDate: paidRow.lastPaymentDate } : {}),
            },
          },
        },
      });
    }

    if (ops.length) {
      const chunkSize = 500;
      for (let i = 0; i < ops.length; i += chunkSize) {
        await Expense.bulkWrite(ops.slice(i, i + chunkSize), { ordered: false });
      }
    }

    await migrations.updateOne(
      { _id: MIGRATION_ID },
      {
        $set: {
          status: 'done',
          appliedAt: new Date(),
          expensesUpdated: expenses.length,
          syntheticPayments: paidMissing.length,
        },
      },
    );

    console.log(
      `Payment ledger migration: ${expenses.length} expense(s), ${paidMissing.length} synthetic payment(s)`,
    );
  } catch (err) {
    await migrations.deleteOne({ _id: MIGRATION_ID });
    throw err;
  }
};
