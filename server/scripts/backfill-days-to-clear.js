/**
 * One-time backfill: set clearedAt + daysToClear on existing Paid expenses.
 *
 * Usage (from server/): node scripts/backfill-days-to-clear.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDatabase } = await import('../src/config/database.js');
await import('../src/models/index.js');
const { Expense } = await import('../src/models/Expense.js');
const { ExpensePayment } = await import('../src/models/ExpensePayment.js');
const {
  calendarDaysBetween,
  findClearedAt,
} = await import('../src/services/payment.service.js');

const run = async () => {
  await connectDatabase();

  const paid = await Expense.find({
    isDraft: { $ne: true },
    status: 'Paid',
    $or: [{ daysToClear: null }, { daysToClear: { $exists: false } }, { clearedAt: null }],
  })
    .select('_id dueDate invoiceDate createdAt grossAmount')
    .lean();

  console.log(`[backfill-days-to-clear] found ${paid.length} paid bill(s)`);

  let updated = 0;
  for (const expense of paid) {
    const payments = await ExpensePayment.find({ expenseId: expense._id, status: 'Active' })
      .select('amount paymentDate createdAt')
      .lean();

    const clearedAt = findClearedAt(payments, expense.grossAmount);
    const anchor = expense.dueDate || expense.invoiceDate || expense.createdAt;
    if (!clearedAt || !anchor) continue;

    const daysToClear = calendarDaysBetween(anchor, clearedAt);
    await Expense.updateOne(
      { _id: expense._id },
      { $set: { clearedAt, daysToClear } },
    );
    updated += 1;
  }

  console.log(`[backfill-days-to-clear] updated ${updated} bill(s)`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
