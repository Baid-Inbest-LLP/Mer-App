import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickMoney,
  emptyTotals,
  previousFinancialYearLabel,
  formatExpenseType,
  formatPaymentStatus,
  isBillsReport,
} from '../src/services/report/reportShared.js';
import { PAYMENT_STATUS } from '../src/constants/paymentStatus.js';

test('pickMoney', () => {
  assert.deepEqual(pickMoney({ net: 1, gross: 5, count: 2 }), {
    net: 1,
    gst: 0,
    tds: 0,
    gross: 5,
    outstanding: 0,
    amountPaid: 0,
    count: 2,
  });
});

test('emptyTotals', () => {
  assert.deepEqual(emptyTotals(), {
    net: 0,
    gst: 0,
    tds: 0,
    gross: 0,
    outstanding: 0,
    amountPaid: 0,
    count: 0,
  });
});

test('previousFinancialYearLabel', () => {
  assert.equal(previousFinancialYearLabel('2025-26'), '2024-25');
  assert.equal(previousFinancialYearLabel(''), '');
});

test('formatExpenseType', () => {
  assert.equal(formatExpenseType('Capital'), 'CE');
  assert.equal(formatExpenseType('Revenue'), 'RE');
  assert.equal(formatExpenseType('Other'), 'Other');
});

test('formatPaymentStatus', () => {
  assert.equal(formatPaymentStatus(PAYMENT_STATUS.PARTIALLY_PAID), 'Partially Paid');
  assert.equal(formatPaymentStatus(PAYMENT_STATUS.HOLD), 'On Hold');
  assert.equal(formatPaymentStatus(PAYMENT_STATUS.PENDING), PAYMENT_STATUS.PENDING);
});

test('isBillsReport', () => {
  assert.equal(isBillsReport({ reportScope: 'due' }), true);
  assert.equal(isBillsReport({ reportScope: 'expenses' }), false);
});
