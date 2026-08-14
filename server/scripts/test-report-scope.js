/**
 * Unit tests for report scope (due bills vs paid expenses).
 * Run: node scripts/test-report-scope.js
 */
import { applyReportScope, normalizeReportScope, REPORT_SCOPE } from '../src/utils/reportScope.js';
import { PAYMENT_STATUS } from '../src/constants/paymentStatus.js';

let passed = 0;
let failed = 0;

const assert = (label, condition) => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${label}`);
};

console.log('reportScope');

assert('normalizes due aliases', normalizeReportScope('due-bills') === REPORT_SCOPE.DUE);
assert('normalizes expense aliases', normalizeReportScope('paid') === REPORT_SCOPE.EXPENSES);
assert('rejects unknown scope', normalizeReportScope('all') === null);

const dueFilter = applyReportScope({ balanceDue: { $gt: 0 } }, 'due');
assert('due includes paid and unpaid', JSON.stringify(dueFilter.status) === JSON.stringify({ $ne: PAYMENT_STATUS.CANCELLED }));
assert('due does not require open balance', dueFilter.balanceDue === undefined);

const paidFilter = applyReportScope({}, 'expenses');
assert('expenses status is Paid', paidFilter.status === PAYMENT_STATUS.PAID);
assert('expenses does not force balanceDue', paidFilter.balanceDue === undefined);

const untouched = applyReportScope({ company: 'Acme' }, '');
assert('empty scope is a no-op', untouched.company === 'Acme' && untouched.status === undefined);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
