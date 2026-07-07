import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri } from '../src/config/index.js';
import { getConnectionOptions } from '../src/config/database.js';
import { Expense } from '../src/models/index.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

await mongoose.connect(uri, getConnectionOptions(uri));

const samples = await Expense.find({ slNo: { $exists: true, $ne: '' } })
  .select('slNo company merType paymentMethod month invoiceDate isDraft')
  .sort({ invoiceDate: 1 })
  .limit(15)
  .lean();

console.log(`Total with slNo: ${await Expense.countDocuments({ slNo: { $exists: true, $ne: '' } })}`);
console.log('Samples:');
for (const e of samples) {
  console.log(`  ${e.slNo} | ${e.company} | mer=${e.merType} pay=${e.paymentMethod} | ${e.month}`);
}

await mongoose.disconnect();
