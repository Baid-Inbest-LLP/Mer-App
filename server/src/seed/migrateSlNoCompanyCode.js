import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri } from '../config/index.js';
import { getConnectionOptions } from '../config/database.js';
import { Expense, Company } from '../models/index.js';
import { buildMerSerial, buildMerSerialBase } from '../utils/merSerial.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

const parseSequence = (slNo) => parseInt(String(slNo || '').split('/').pop(), 10) || 0;

mongoose
  .connect(uri, getConnectionOptions(uri))
  .then(async () => {
    console.log('Connected. Migrating expense serials to use company code...');

    const companies = await Company.find({}, 'name code').lean();
    const codeByName = new Map(companies.map((c) => [c.name, c.code]));

    const expenses = await Expense.find({ slNo: { $exists: true, $ne: '' } })
      .select('_id slNo company month financialYear invoiceDate createdAt')
      .lean();

    const groups = new Map();
    for (const expense of expenses) {
      const company = String(expense.company || '').trim();
      const fy = String(expense.financialYear || '').trim();
      const month = String(expense.month || '').trim();
      const key = `${company}|${fy}|${month}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(expense);
    }

    let updated = 0;
    let skipped = 0;

    for (const [key, group] of groups) {
      const [companyName] = key.split('|');
      const companyCode = codeByName.get(companyName);
      if (!companyCode) {
        console.warn(`No company code for "${companyName}", skipping ${group.length} expense(s).`);
        skipped += group.length;
        continue;
      }

      group.sort((a, b) => {
        const seqDiff = parseSequence(a.slNo) - parseSequence(b.slNo);
        if (seqDiff !== 0) return seqDiff;
        return new Date(a.invoiceDate || a.createdAt) - new Date(b.invoiceDate || b.createdAt);
      });

      for (let index = 0; index < group.length; index += 1) {
        const expense = group[index];
        const base = buildMerSerialBase({
          companyCode,
          month: expense.month,
          invoiceDate: expense.invoiceDate,
        });
        const newSlNo = buildMerSerial(base, index + 1);

        if (newSlNo !== expense.slNo) {
          await Expense.updateOne({ _id: expense._id }, { $set: { slNo: newSlNo } });
          console.log(`  ${expense.slNo} → ${newSlNo}`);
          updated += 1;
        }
      }
    }

    console.log(`Done. Updated ${updated} expense serial number(s), skipped ${skipped}.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
