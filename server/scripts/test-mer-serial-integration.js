/**
 * Integration test for next expense serial via DB + service layer.
 * Run: node scripts/test-mer-serial-integration.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri } from '../src/config/index.js';
import { getConnectionOptions } from '../src/config/database.js';
import { getNextSlNo } from '../src/services/expense.service.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

const cases = [
  {
    label: 'BILLP cash April',
    params: {
      company: 'Baid Inbest Llp',
      month: 'April',
      invoiceDate: '2026-04-15',
      merType: 'Cash',
    },
    expectPattern: /^BILLP\/EXP\/CASH\/Apr'26\/\d{3}$/,
  },
  {
    label: 'BSIBPL bank July',
    params: {
      company: 'Baid Solutions Insurance Broking Private Limited',
      month: 'July',
      invoiceDate: '2026-07-07',
      merType: 'Bank',
    },
    expectPattern: /^BSIBPL\/EXP\/BNK\/Jul'26\/\d{3}$/,
  },
];

let passed = 0;
let failed = 0;

try {
  await mongoose.connect(uri, getConnectionOptions(uri));
  console.log('Connected. Running integration tests...\n');

  for (const testCase of cases) {
    const slNo = await getNextSlNo(testCase.params);
    if (testCase.expectPattern.test(slNo)) {
      passed += 1;
      console.log(`  ✓ ${testCase.label}: ${slNo}`);
    } else {
      failed += 1;
      console.error(`  ✗ ${testCase.label}`);
      console.error(`    got: ${slNo}`);
      console.error(`    expected pattern: ${testCase.expectPattern}`);
    }
  }

  const first = await getNextSlNo(cases[0].params);
  const second = await getNextSlNo(cases[0].params);
  const seq1 = parseInt(first.split('/').pop(), 10);
  const seq2 = parseInt(second.split('/').pop(), 10);
  if (seq2 === seq1) {
    passed += 1;
    console.log(`  ✓ sequence stable for same bucket: ${first}`);
  } else {
    failed += 1;
    console.error(`  ✗ sequence changed between calls: ${first} → ${second}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
} catch (err) {
  console.error('Integration test error:', err.message);
  failed += 1;
} finally {
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}
