/**
 * Remap expense approvalStatus to: Pending → Completed → Approved.
 * Also runs automatically on server start via migrateApprovalStatus().
 *
 * Run: node scripts/migrate-approval-status.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri } from '../src/config/index.js';
import { getConnectionOptions } from '../src/config/database.js';
import { Expense } from '../src/models/index.js';
import { migrateApprovalStatus } from '../src/services/expense.service.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

const countByStatus = async () => {
  const rows = await Expense.aggregate([
    { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id ?? '(missing)', r.count]));
};

const run = async () => {
  await mongoose.connect(uri, getConnectionOptions(uri));
  console.log('Connected. Remapping expense approval statuses...\n');

  const before = await countByStatus();
  console.log('Before:', before);

  await migrateApprovalStatus();

  const after = await countByStatus();
  console.log('After:', after);
  console.log('\nDone.');
  await mongoose.disconnect();
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
