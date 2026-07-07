/**
 * Migrates existing expense slNo values to:
 * {COMPANY_CODE}/EXP/{MER_TYPE}/{MONTH'FY}/{SEQ}
 *
 * Run: node scripts/migrate-expense-slno.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri } from '../src/config/index.js';
import { getConnectionOptions } from '../src/config/database.js';
import { Expense, Company } from '../src/models/index.js';
import { buildMerSerial, buildMerSerialBase } from '../src/utils/merSerial.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

/** Map legacy mer/payment values to Bank or Cash for serial generation. */
const resolveMerTypeForMigration = (expense) => {
  const raw = expense.merType || expense.paymentMethod || '';
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'cash') return 'Cash';
  if (
    normalized === 'bank'
    || normalized === 'upi'
    || normalized === 'debit/credit card'
    || normalized.includes('card')
  ) {
    return 'Bank';
  }
  return 'Bank';
};

const parseOldSequence = (slNo) => parseInt(String(slNo || '').split('/').pop(), 10) || 0;

const sortExpenses = (a, b) => {
  const dateDiff = new Date(a.invoiceDate || a.createdAt) - new Date(b.invoiceDate || b.createdAt);
  if (dateDiff !== 0) return dateDiff;
  const createdDiff = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  if (createdDiff !== 0) return createdDiff;
  return parseOldSequence(a.slNo) - parseOldSequence(b.slNo);
};

const migrate = async () => {
  await mongoose.connect(uri, getConnectionOptions(uri));
  console.log('Connected. Migrating expense serial numbers...\n');

  const companies = await Company.find({}, 'name code').lean();
  const codeByName = new Map(companies.map((c) => [c.name, c.code]));

  const expenses = await Expense.find({
    slNo: { $exists: true, $ne: '' },
    isDraft: { $ne: true },
  })
    .select('_id slNo company month invoiceDate createdAt merType paymentMethod')
    .lean();

  console.log(`Found ${expenses.length} expense(s) to migrate.`);

  const groups = new Map();
  const skipped = [];

  for (const expense of expenses) {
    const companyCode = codeByName.get(String(expense.company || '').trim());
    if (!companyCode) {
      skipped.push({ id: expense._id, slNo: expense.slNo, reason: `No company code for "${expense.company}"` });
      continue;
    }

    const merType = resolveMerTypeForMigration(expense);
    const base = buildMerSerialBase({
      companyCode,
      month: expense.month,
      invoiceDate: expense.invoiceDate,
      merType,
    });

    if (!base) {
      skipped.push({ id: expense._id, slNo: expense.slNo, reason: 'Could not build serial base' });
      continue;
    }

    const key = base;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...expense, merType, base });
  }

  const updates = [];

  for (const [base, group] of groups) {
    group.sort(sortExpenses);
    group.forEach((expense, index) => {
      const newSlNo = buildMerSerial(base, index + 1);
      if (newSlNo !== expense.slNo) {
        updates.push({
          id: expense._id,
          oldSlNo: expense.slNo,
          newSlNo,
          merType: expense.merType,
        });
      }
    });
  }

  console.log(`Will update ${updates.length} expense(s) across ${groups.size} bucket(s).`);
  if (skipped.length) {
    console.log(`Skipping ${skipped.length} expense(s):`);
    skipped.forEach((s) => console.log(`  - ${s.slNo}: ${s.reason}`));
  }

  if (updates.length === 0) {
    console.log('\nNothing to update.');
    return;
  }

  // Pass 1: clear slNo to avoid unique-index collisions during reassignment.
  await Expense.bulkWrite(
    updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id },
        update: { $set: { slNo: `__MIGRATE__${u.id}` } },
      },
    })),
  );

  // Pass 2: assign final serial numbers.
  await Expense.bulkWrite(
    updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id },
        update: { $set: { slNo: u.newSlNo } },
      },
    })),
  );

  console.log('\nSample updates:');
  updates.slice(0, 10).forEach((u) => {
    console.log(`  ${u.oldSlNo} → ${u.newSlNo}`);
  });
  if (updates.length > 10) {
    console.log(`  ... and ${updates.length - 10} more`);
  }

  console.log(`\nDone. Updated ${updates.length} expense serial number(s).`);
};

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
