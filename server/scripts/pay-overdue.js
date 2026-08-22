/**
 * Records full payment for all overdue open bills (due date before today).
 *
 * Usage (from server/): node scripts/pay-overdue.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDatabase } = await import('../src/config/database.js');
const { User } = await import('../src/models/index.js');
const { Expense } = await import('../src/models/Expense.js');
const { OPEN_PAYMENT_STATUSES, roundMoney } = await import('../src/constants/paymentStatus.js');
const {
  requiresBankAccount,
  requiresCardNumber,
  requiresPaymentRef,
} = await import('../src/constants/paymentMethods.js');
const { addPayment } = await import('../src/services/payment.service.js');

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const resolvePaymentMethod = (expense) => {
  const method = String(expense.paymentMethod || '').trim();
  if (method) return method;
  return expense.merType === 'Cash' ? 'Cash' : 'NEFT';
};

const buildPaymentPayload = (expense) => {
  const method = resolvePaymentMethod(expense);
  const amount = roundMoney(expense.balanceDue ?? 0);
  const payload = {
    amount,
    paymentDate: new Date(),
    paymentMethod: method,
    merType: expense.merType || (method === 'Cash' ? 'Cash' : 'Bank'),
    notes: 'Bulk overdue settlement',
  };

  if (requiresBankAccount(method)) {
    payload.bankAccountNumber = String(expense.bankAccountNumber || '').trim() || 'BILLP - ICICI - 2404';
  }
  if (requiresCardNumber(method)) {
    payload.cardNumber = String(expense.cardNumber || '').trim() || 'BULK-CARD';
  }
  if (requiresPaymentRef(method)) {
    const slug = String(expense.slNo || expense._id).replace(/[^\w-]+/g, '-');
    payload.paymentRefNumber = `BULK-OVERDUE-${slug}-${Date.now()}`;
  }

  return payload;
};

const run = async () => {
  await connectDatabase();

  const systemUser = await User.findOne({ role: { $in: ['superadmin', 'admin'] } })
    .sort({ createdAt: 1 })
    .lean();
  if (!systemUser) {
    throw new Error('No admin/superadmin user found to attribute payments');
  }

  const todayStart = startOfDay();
  const filter = {
    isDraft: { $ne: true },
    status: { $in: OPEN_PAYMENT_STATUSES },
    balanceDue: { $gt: 0 },
    dueDate: { $lt: todayStart },
  };

  const overdue = await Expense.find(filter)
    .select('_id slNo balanceDue paymentMethod merType bankAccountNumber cardNumber dueDate status')
    .sort({ dueDate: 1, slNo: 1 })
    .lean();

  console.log(`[pay-overdue] found ${overdue.length} overdue bill(s)`);

  let paid = 0;
  let failed = 0;
  let totalAmount = 0;

  for (const expense of overdue) {
    const payload = buildPaymentPayload(expense);
    if (!(payload.amount > 0)) {
      console.warn(`[pay-overdue] skip ${expense.slNo || expense._id}: zero balance`);
      continue;
    }

    try {
      await addPayment(expense._id, payload, systemUser);
      paid += 1;
      totalAmount = roundMoney(totalAmount + payload.amount);
      console.log(
        `[pay-overdue] paid ${expense.slNo || expense._id} amount=${payload.amount} method=${payload.paymentMethod}`,
      );
    } catch (err) {
      failed += 1;
      console.error(
        `[pay-overdue] failed ${expense.slNo || expense._id}: ${err?.message || err}`,
      );
    }
  }

  console.log(
    `[pay-overdue] done paid=${paid} failed=${failed} totalAmount=${totalAmount}`,
  );

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch(async (err) => {
  console.error('[pay-overdue] failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
