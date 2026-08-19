/**
 * Replace all expense heads with the Control Center category list.
 * Run: node scripts/replace-expense-heads.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { EXPENSE_HEADS, normalizeMongoUri } from '../src/config/index.js';
import { getConnectionOptions } from '../src/config/database.js';
import { ExpenseHead } from '../src/models/index.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

const run = async () => {
  await mongoose.connect(uri, getConnectionOptions(uri));
  const deleted = await ExpenseHead.deleteMany({});
  const docs = EXPENSE_HEADS.map((name, index) => ({
    name,
    sortOrder: index,
    isActive: true,
  }));
  const inserted = await ExpenseHead.insertMany(docs);
  console.log(`Removed ${deleted.deletedCount} expense heads`);
  console.log(`Inserted ${inserted.length}: ${inserted.map((h) => h.name).join(', ')}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
