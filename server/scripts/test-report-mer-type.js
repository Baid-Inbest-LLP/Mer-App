/**
 * Unit tests for monthly report MER type bucketing (bank/cash/combined).
 * Run: node scripts/test-report-mer-type.js
 */
import {
  buildReportMerTypeFilter,
  cashReportMerTypeMatch,
  bankReportMerTypeMatch,
} from '../src/utils/reportMerType.js';

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

const matchesCash = (expense) => {
  const filter = cashReportMerTypeMatch;
  return evaluateOr(filter, expense);
};

const matchesBank = (expense) => {
  const filter = bankReportMerTypeMatch;
  return evaluateNor(filter, expense);
};

const evaluateOr = (filter, doc) => filter.$or.some((clause) => evaluateClause(clause, doc));

const evaluateNor = (filter, doc) => !filter.$nor.some((clause) => evaluateClause(clause, doc));

const evaluateClause = (clause, doc) => {
  if (clause.$or) return evaluateOr(clause, doc);
  if (clause.$and) return clause.$and.every((c) => evaluateClause(c, doc));
  if (clause.$nor) return !clause.$nor.some((c) => evaluateClause(c, doc));

  const [field, expected] = Object.entries(clause)[0];
  const value = doc[field];

  if (expected && typeof expected === 'object') {
    if (expected.$ne !== undefined) return value !== expected.$ne;
    if (expected.$exists !== undefined) {
      const exists = value !== undefined && value !== null;
      return expected.$exists ? exists : !exists;
    }
  }

  return value === expected;
};

/** Mirror aggregation $switch logic in JS for test fixtures. */
const classifyReportMerType = (expense) => {
  if (expense.merType === 'Cash') return 'cash';
  if (expense.merType === 'Bank') return 'bank';
  if (expense.paymentMethod === 'Cash') return 'cash';
  return 'bank';
};

const fixtures = [
  { label: 'merType Bank', expense: { merType: 'Bank', paymentMethod: 'UPI' }, expected: 'bank' },
  { label: 'merType Cash', expense: { merType: 'Cash', paymentMethod: 'Bank' }, expected: 'cash' },
  { label: 'legacy UPI', expense: { merType: 'UPI', paymentMethod: 'UPI' }, expected: 'bank' },
  { label: 'legacy Card', expense: { merType: 'Debit/Credit Card', paymentMethod: 'Debit/Credit Card' }, expected: 'bank' },
  { label: 'missing merType + Bank payment', expense: { paymentMethod: 'Bank' }, expected: 'bank' },
  { label: 'missing merType + Cash payment', expense: { paymentMethod: 'Cash' }, expected: 'cash' },
  { label: 'missing merType + UPI payment', expense: { paymentMethod: 'UPI' }, expected: 'bank' },
];

console.log('reportMerType unit tests\n');

console.log('buildReportMerTypeFilter');
assert('bank filter', buildReportMerTypeFilter('bank')?.$nor?.length === 2);
assert('cash filter', buildReportMerTypeFilter('cash')?.$or?.length === 2);
assert('combined is null', buildReportMerTypeFilter('combined') === null);

console.log('\naggregation vs query filter alignment');
for (const { label, expense, expected } of fixtures) {
  const classified = classifyReportMerType(expense);
  assert(`${label} classified as ${expected}`, classified === expected);

  const inCash = matchesCash(expense);
  const inBank = matchesBank(expense);
  if (expected === 'cash') {
    assert(`${label} matches cash query`, inCash && !inBank);
  } else {
    assert(`${label} matches bank query`, inBank && !inCash);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
