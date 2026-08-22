import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abbreviateMerType,
  abbreviateMonthName,
  formatMonthFyLabel,
  buildMerSerialBase,
  buildMerSerial,
  buildMerSerialPattern,
  SERIAL_KIND,
} from '../src/utils/merSerial.js';

test('abbreviateMerType', () => {
  assert.equal(abbreviateMerType('Cash'), 'CASH');
  assert.equal(abbreviateMerType('Bank'), 'BNK');
  assert.equal(abbreviateMerType('UPI'), null);
  assert.equal(abbreviateMerType(''), null);
});

test('abbreviateMonthName', () => {
  assert.equal(abbreviateMonthName('April'), 'Apr');
  assert.equal(abbreviateMonthName('July'), 'Jul');
});

test('formatMonthFyLabel', () => {
  assert.equal(formatMonthFyLabel('April', new Date('2026-04-15')), "Apr'26");
  assert.equal(formatMonthFyLabel('July', new Date('2026-07-07')), "Jul'26");
});

test('buildMerSerialBase and buildMerSerial', () => {
  const baseCash = buildMerSerialBase({
    companyCode: 'BILLP',
    month: 'April',
    invoiceDate: new Date('2026-04-10'),
    merType: 'Cash',
  });
  assert.equal(baseCash, "BILLP/BILL/CASH/Apr'26");
  assert.equal(buildMerSerial(baseCash, 1), "BILLP/BILL/CASH/Apr'26/001");

  const baseBank = buildMerSerialBase({
    companyCode: 'BSIBPL',
    month: 'May',
    invoiceDate: new Date('2026-05-20'),
    merType: 'Bank',
    kind: SERIAL_KIND.EXPENSE,
  });
  assert.equal(baseBank, "BSIBPL/EXP/BNK/May'26");
  assert.equal(buildMerSerial(baseBank, 2), "BSIBPL/EXP/BNK/May'26/002");
});

test('buildMerSerialPattern', () => {
  const baseCash = buildMerSerialBase({
    companyCode: 'BILLP',
    month: 'April',
    invoiceDate: new Date('2026-04-10'),
    merType: 'Cash',
  });
  const pattern = buildMerSerialPattern(baseCash);
  assert.ok(pattern instanceof RegExp);
  assert.match("BILLP/BILL/CASH/Apr'26/001", pattern);
});
