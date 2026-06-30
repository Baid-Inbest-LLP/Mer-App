import ExcelJS from 'exceljs';
import { Expense } from '../models/Expense.js';
import { Company } from '../models/Company.js';
import { buildExpenseQuery } from '../utils/queryBuilder.js';
import { getFinancialYear } from '../config/index.js';
import {
  buildMonthlyReportNo,
  resolveCustomizedReportMeta,
} from '../utils/merReportSerial.js';

const baseMatch = (filter) => ({
  ...filter,
  isDraft: { $ne: true },
  approvalStatus: 'Completed',
});

export const getReportSummary = async (query) => {
  const filter = buildExpenseQuery(query);

  const [summary, vendorCount] = await Promise.all([
    Expense.aggregate([
      { $match: baseMatch(filter) },
      {
        $group: {
          _id: null,
          totalNet: { $sum: '$netAmount' },
          totalGST: { $sum: '$totalGST' },
          totalTDS: { $sum: '$tds' },
          grossAmount: { $sum: '$grossAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: baseMatch(filter) },
      { $group: { _id: '$vendor' } },
      { $count: 'vendors' },
    ]),
  ]);

  return {
    totalNetAmount: summary[0]?.totalNet || 0,
    totalGST: summary[0]?.totalGST || 0,
    totalTDS: summary[0]?.totalTDS || 0,
    grossAmount: summary[0]?.grossAmount || 0,
    entryCount: summary[0]?.count || 0,
    vendorCount: vendorCount[0]?.vendors || 0,
  };
};

export const getExpenseHeadSummary = async (query) => {
  const filter = buildExpenseQuery(query);
  return Expense.aggregate([
    { $match: baseMatch(filter) },
    {
      $group: {
        _id: '$headOfExpense',
        net: { $sum: '$netAmount' },
        gst: { $sum: '$totalGST' },
        tds: { $sum: '$tds' },
        gross: { $sum: '$grossAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { gross: -1 } },
  ]);
};

export const getMonthlyReport = async (query) => {
  const filter = buildExpenseQuery(query);
  const financialYear = query.financialYear || getFinancialYear();
  const rows = await Expense.aggregate([
    { $match: baseMatch(filter) },
    {
      $group: {
        _id: '$month',
        net: { $sum: '$netAmount' },
        gst: { $sum: '$totalGST' },
        tds: { $sum: '$tds' },
        gross: { $sum: '$grossAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    ...row,
    reportNo: buildMonthlyReportNo({ financialYear, month: row._id }),
  }));
};

const formatFilterLine = (query) =>
  Object.entries(query)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

export const getMonthlyDetailedReport = async (query) => {
  const filter = buildExpenseQuery(query);

  const docs = await Expense.find(baseMatch(filter))
    .sort({ invoiceDate: 1 })
    .lean();

  const totals = { net: 0, gst: 0, tds: 0, gross: 0 };
  const entries = docs.map((e) => {
    totals.net += e.netAmount || 0;
    totals.gst += e.totalGST || 0;
    totals.tds += e.tds || 0;
    totals.gross += e.grossAmount || 0;
    return {
      _id: e._id,
      slNo: e.slNo || '',
      invoiceDate: e.invoiceDate || null,
      month: e.month || '',
      company: e.company || '',
      coNames: e.coNames || '',
      headOfExpense: e.headOfExpense || '',
      particulars: e.particulars || '',
      expenseType: e.expenseType || '',
      netAmount: e.netAmount || 0,
      totalGST: e.totalGST || 0,
      tds: e.tds || 0,
      grossAmount: e.grossAmount || 0,
      paymentMethod: e.paymentMethod || e.merType || '',
      approvalStatus: e.approvalStatus || '',
    };
  });

  return {
    ...(await resolveCustomizedReportMeta(query, Company)),
    entries,
    totals,
    count: entries.length,
  };
};

export const generateMonthlyExcel = async (query) => {
  const filter = buildExpenseQuery(query);

  const entries = await Expense.find(baseMatch(filter))
    .sort({ invoiceDate: 1 })
    .lean();

  const { reportNo, filename } = await resolveCustomizedReportMeta(query, Company);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MER System';
  workbook.created = new Date();

  const monthLabel = query.month || 'All Months';
  const sheet = workbook.addWorksheet(String(monthLabel).slice(0, 31));

  if (reportNo) {
    sheet.addRow(['Report No', reportNo]);
  }
  sheet.addRow([`MER — Monthly Report (${monthLabel})`]);
  sheet.addRow(['Generated', new Date().toLocaleString()]);
  sheet.addRow(['Filters', formatFilterLine(query) || 'None']);
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'S.No',
    'MER No',
    'Invoice Date',
    'Month',
    'Company',
    'Co Name',
    'Head of Expense',
    'Particulars',
    'Expense Type',
    'Net Amount',
    'Total GST',
    'TDS',
    'Gross Amount',
    'Payment Method',
    'Approval Status',
  ]);

  const totals = { net: 0, gst: 0, tds: 0, gross: 0 };

  entries.forEach((e, index) => {
    totals.net += e.netAmount || 0;
    totals.gst += e.totalGST || 0;
    totals.tds += e.tds || 0;
    totals.gross += e.grossAmount || 0;
    sheet.addRow([
      index + 1,
      e.slNo || '',
      e.invoiceDate ? new Date(e.invoiceDate).toLocaleDateString('en-IN') : '',
      e.month || '',
      e.company || '',
      e.coNames || '',
      e.headOfExpense || '',
      e.particulars || '',
      e.expenseType || '',
      e.netAmount || 0,
      e.totalGST || 0,
      e.tds || 0,
      e.grossAmount || 0,
      e.paymentMethod || e.merType || '',
      e.approvalStatus || '',
    ]);
  });

  const totalRow = sheet.addRow([
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `${entries.length} entries`,
    totals.net,
    totals.gst,
    totals.tds,
    totals.gross,
    '',
    '',
  ]);

  headerRow.font = { bold: true };
  totalRow.font = { bold: true };
  sheet.getRow(reportNo ? 2 : 1).font = { bold: true, size: 14 };
  if (reportNo) {
    sheet.getRow(1).font = { bold: true };
  }

  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value ? String(cell.value) : '';
      if (value.length > maxLength) maxLength = value.length;
    });
    column.width = Math.min(maxLength + 2, 40);
  });

  return { workbook, filename };
};

export const generateSummaryExcel = async (query) => {
  const [summary, headSummary, monthlyReport] = await Promise.all([
    getReportSummary(query),
    getExpenseHeadSummary(query),
    getMonthlyReport(query),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MER System';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['MER — Summary Report']);
  summarySheet.addRow(['Generated', new Date().toLocaleString()]);
  summarySheet.addRow(['Filters', formatFilterLine(query) || 'None']);
  summarySheet.addRow([]);
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Total Net', summary.totalNetAmount]);
  summarySheet.addRow(['Total GST', summary.totalGST]);
  summarySheet.addRow(['Total TDS', summary.totalTDS]);
  summarySheet.addRow(['Gross Amount', summary.grossAmount]);
  summarySheet.addRow(['Entries', summary.entryCount]);
  summarySheet.addRow(['Vendors', summary.vendorCount]);

  const headSheet = workbook.addWorksheet('Expense Heads');
  headSheet.addRow(['Head', 'Net', 'GST', 'TDS', 'Gross', 'Count']);
  headSummary.forEach((h) => {
    headSheet.addRow([h._id, h.net, h.gst, h.tds, h.gross, h.count]);
  });

  const monthlySheet = workbook.addWorksheet('Monthly');
  monthlySheet.addRow(['Report No', 'Month', 'Net', 'GST', 'Gross', 'Entries']);
  monthlyReport.forEach((m) => {
    monthlySheet.addRow([m.reportNo || '', m._id, m.net, m.gst, m.gross, m.count]);
  });

  [summarySheet, headSheet, monthlySheet].forEach((sheet) => {
    sheet.getRow(1).font = { bold: true };
  });

  return workbook;
};
