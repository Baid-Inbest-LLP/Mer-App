import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reportSerialKind,
  abbreviateMonthlyReportMerType,
  buildMonthlyReportNo,
  buildMonthlyReportFilename,
  buildFyReportNo,
  buildFyReportFilename,
} from '../src/utils/merReportSerial.js';

test('reportSerialKind', () => {
  assert.equal(reportSerialKind('due'), 'BILL');
  assert.equal(reportSerialKind('bills'), 'BILL');
  assert.equal(reportSerialKind('expenses'), 'MER');
  assert.equal(reportSerialKind(undefined), 'MER');
});

test('abbreviateMonthlyReportMerType', () => {
  assert.equal(abbreviateMonthlyReportMerType('cash'), 'CASH');
  assert.equal(abbreviateMonthlyReportMerType('bank'), 'BNK');
  assert.equal(abbreviateMonthlyReportMerType('combined'), 'COMBINED');
  assert.equal(abbreviateMonthlyReportMerType(''), 'COMBINED');
});

test('buildMonthlyReportNo', () => {
  assert.equal(
    buildMonthlyReportNo({
      companyCode: 'BILLP',
      month: 'April',
      financialYear: '2025-26',
      merType: 'combined',
      reportScope: 'expenses',
    }),
    "BILLP/MER/COMBINED/Apr'25",
  );
  assert.equal(
    buildMonthlyReportNo({
      companyCode: 'BILLP',
      month: 'April',
      financialYear: '2025-26',
      merType: 'bank',
      reportScope: 'due',
    }),
    "BILLP/BILL/BNK/Apr'25",
  );
});

test('buildMonthlyReportFilename', () => {
  assert.equal(
    buildMonthlyReportFilename({
      companyCode: 'BILLP',
      month: 'April',
      financialYear: '2025-26',
      merType: 'bank',
      reportScope: 'due',
    }),
    'BILLP-BILL-BNK-Apr25.xlsx',
  );
});

test('buildFyReportNo and filename', () => {
  assert.equal(
    buildFyReportNo({
      companyCode: 'BILLP',
      financialYear: '2025-26',
      merType: 'cash',
      reportScope: 'due',
    }),
    'BILLP/BILL/CASH/25-26',
  );
  assert.equal(
    buildFyReportFilename({
      companyCode: 'BILLP',
      financialYear: '2025-26',
      merType: 'cash',
      reportScope: 'due',
    }),
    'BILLP-BILL-CASH-25-26.xlsx',
  );
});
