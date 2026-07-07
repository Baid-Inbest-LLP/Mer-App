/**
 * Unit tests for monthly MER report number format.
 * Run: node scripts/test-mer-report-serial.js
 */
import {
  abbreviateMonthlyReportMerType,
  buildMonthlyReportNo,
  buildMonthlyReportFilename,
} from '../src/utils/merReportSerial.js';

let passed = 0;
let failed = 0;

const assert = (label, actual, expected) => {
  if (actual === expected) {
    passed += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${label}`);
  console.error(`    expected: ${expected}`);
  console.error(`    actual:   ${actual}`);
};

console.log('merReportSerial unit tests\n');

console.log('abbreviateMonthlyReportMerType');
assert('combined', abbreviateMonthlyReportMerType('combined'), 'COMBINED');
assert('bank', abbreviateMonthlyReportMerType('bank'), 'BNK');
assert('cash', abbreviateMonthlyReportMerType('cash'), 'CASH');

console.log('\nbuildMonthlyReportNo');
assert(
  'combined monthly',
  buildMonthlyReportNo({
    companyCode: 'BILLP',
    month: 'April',
    financialYear: '2026-27',
    merType: 'combined',
  }),
  "BILLP/MER/COMBINED/Apr'26",
);
assert(
  'bank monthly',
  buildMonthlyReportNo({
    companyCode: 'BSIBPL',
    month: 'July',
    financialYear: '2026-27',
    merType: 'bank',
  }),
  "BSIBPL/MER/BNK/Jul'26",
);
assert(
  'cash monthly',
  buildMonthlyReportNo({
    companyCode: 'BNB',
    month: 'May',
    financialYear: '2026-27',
    merType: 'cash',
  }),
  "BNB/MER/CASH/May'26",
);

console.log('\nbuildMonthlyReportFilename');
assert(
  'filename slug',
  buildMonthlyReportFilename({
    companyCode: 'BILLP',
    month: 'April',
    financialYear: '2026-27',
    merType: 'combined',
  }),
  'BILLP-MER-COMBINED-Apr26.xlsx',
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
