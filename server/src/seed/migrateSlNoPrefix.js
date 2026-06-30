import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri } from '../config/index.js';
import { getConnectionOptions } from '../config/database.js';
import { Expense } from '../models/index.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

mongoose
  .connect(uri, getConnectionOptions(uri))
  .then(async () => {
    console.log('Connected. Migrating expense serial prefix MER/ → EXP/...');

    const expenses = await Expense.find({ slNo: /^MER\// }).select('_id slNo').lean();

    console.log(`Found ${expenses.length} expense(s) to update.`);

    let updated = 0;
    for (const expense of expenses) {
      const newSlNo = expense.slNo.replace(/^MER\//, 'EXP/');
      await Expense.updateOne({ _id: expense._id }, { $set: { slNo: newSlNo } });
      updated += 1;
      console.log(`  ${expense.slNo} → ${newSlNo}`);
    }

    console.log(`Done. Updated ${updated} expense serial number(s).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
