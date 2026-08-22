import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_STATUS } from '../src/constants/paymentStatus.js';
import { normalizeReportScope, applyReportScope, REPORT_SCOPE } from '../src/utils/reportScope.js';

test('normalizeReportScope', () => {
  assert.equal(normalizeReportScope('due'), REPORT_SCOPE.DUE);
  assert.equal(normalizeReportScope('bills'), REPORT_SCOPE.DUE);
  assert.equal(normalizeReportScope('expenses'), REPORT_SCOPE.EXPENSES);
  assert.equal(normalizeReportScope('paid'), REPORT_SCOPE.EXPENSES);
  assert.equal(normalizeReportScope(''), null);
});

test('applyReportScope for due bills', () => {
  const filter = {};
  applyReportScope(filter, 'due');
  assert.deepEqual(filter, { status: { $ne: PAYMENT_STATUS.CANCELLED } });
});

test('applyReportScope for paid expenses', () => {
  const filter = { balanceDue: { $gt: 0 } };
  applyReportScope(filter, 'expenses');
  assert.equal(filter.status, PAYMENT_STATUS.PAID);
  assert.deepEqual(filter.balanceDue, { $gt: 0 });
});

test('applyReportScope leaves unknown scope unchanged', () => {
  const filter = { company: 'Acme' };
  applyReportScope(filter, 'unknown');
  assert.deepEqual(filter, { company: 'Acme' });
});
