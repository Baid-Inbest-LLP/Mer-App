/**
 * Unit tests for expense serial number format.
 * Run: node scripts/test-mer-serial.js
 */
import {
  applySerialKind,
  abbreviateMerType,
  abbreviateMonthName,
  formatMonthFyLabel,
  buildMerSerialBase,
  buildMerSerial,
  buildMerSerialCountPattern,
  buildMerSerialPattern,
  SERIAL_KIND,
} from '../src/utils/merSerial.js';

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

console.log('merSerial unit tests\n');

console.log('abbreviateMerType');
assert('Cash → CASH', abbreviateMerType('Cash'), 'CASH');
assert('Bank → BNK', abbreviateMerType('Bank'), 'BNK');
assert('UPI → null', abbreviateMerType('UPI'), null);
assert('empty → null', abbreviateMerType(''), null);

console.log('\nabbreviateMonthName');
assert('April → Apr', abbreviateMonthName('April'), 'Apr');
assert('July → Jul', abbreviateMonthName('July'), 'Jul');

console.log('\nformatMonthFyLabel');
assert(
  "April 2026 → Apr'26",
  formatMonthFyLabel('April', new Date('2026-04-15')),
  "Apr'26",
);
assert(
  "July 2026 → Jul'26",
  formatMonthFyLabel('July', new Date('2026-07-07')),
  "Jul'26",
);

console.log('\nbuildMerSerialBase');
const baseCash = buildMerSerialBase({
  companyCode: 'BILLP',
  month: 'April',
  invoiceDate: new Date('2026-04-10'),
  merType: 'Cash',
});
assert('cash base', baseCash, "BILLP/BILL/CASH/Apr'26");

const baseBank = buildMerSerialBase({
  companyCode: 'BSIBPL',
  month: 'May',
  invoiceDate: new Date('2026-05-20'),
  merType: 'Bank',
  kind: SERIAL_KIND.EXPENSE,
});
assert('bank expense base', baseBank, "BSIBPL/EXP/BNK/May'26");

console.log('\nbuildMerSerial');
assert('sequence 1', buildMerSerial(baseCash, 1), "BILLP/BILL/CASH/Apr'26/001");
assert('sequence 12', buildMerSerial(baseCash, 12), "BILLP/BILL/CASH/Apr'26/012");
assert('sequence padded', buildMerSerial(baseBank, 2), "BSIBPL/EXP/BNK/May'26/002");

console.log('\nbuildMerSerialPattern');
const pattern = buildMerSerialPattern(baseCash);
assert(
  'matches serial',
  pattern.test("BILLP/BILL/CASH/Apr'26/003"),
  true,
);
assert(
  'rejects different mer type',
  pattern.test("BILLP/BILL/BNK/Apr'26/001"),
  false,
);

console.log('\nbuildMerSerialCountPattern');
const countPattern = buildMerSerialCountPattern(baseCash);
assert('matches bill serial for count', countPattern.test("BILLP/BILL/CASH/Apr'26/003"), true);
assert('matches expense serial for count', countPattern.test("BILLP/EXP/CASH/Apr'26/003"), true);
assert('matches legacy mer serial for count', countPattern.test("BILLP/MER/CASH/Apr'26/003"), true);

console.log('\napplySerialKind');
assert(
  'bill to expense',
  applySerialKind("BILLP/BILL/CASH/Apr'26/003", SERIAL_KIND.EXPENSE),
  "BILLP/EXP/CASH/Apr'26/003",
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
