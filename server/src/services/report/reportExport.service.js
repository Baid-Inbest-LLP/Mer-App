import { Expense } from '../../models/Expense.js';
import { Company } from '../../models/Company.js';
import { buildExpenseQuery } from '../../utils/queryBuilder.js';
import { getFinancialYear } from '../../config/index.js';
import { formatReportMonthLabel, formatMonthRangeAbbrev } from '../../utils/merSerial.js';
import { toLocationLabel } from '../../utils/locationFormat.js';
import {
  buildDetailTitle,
  buildTotalsLabel,
  buildMerStyledSheet,
  createMerWorkbook,
  fmtDateDMY,
} from '../../utils/excelGenerator.js';
import { buildMonthlyReportHtml } from '../../utils/pdfGenerator.js';
import { renderHtmlToPdfBuffer } from '../../utils/puppeteerPdf.js';
import {
  baseMatch,
  resolveCompanyContext,
  resolveDetailReportMeta,
  isBillsReport,
  formatPaymentStatus,
  formatExpenseType,
  formatPaymentFrom,
  DETAIL_HEADERS,
  BILLS_DETAIL_HEADERS,
} from './reportShared.js';
import { getReportSummary, getExpenseHeadSummary } from './reportSummary.service.js';
import { getMonthlyReport } from './reportOverview.service.js';

/**
 * Assemble the shared monthly-detail report model (headers/rows/totals/styling
 * metadata). Consumed by both the Excel and PDF generators so the two exports
 * stay identical in content and layout.
 */
const buildMonthlyReportModel = async (query) => {
  const filter = buildExpenseQuery(query);
  const financialYear = query.financialYear || getFinancialYear();

  const [entries, meta, companyCtx, companies] = await Promise.all([
    Expense.find(baseMatch(filter)).sort({ invoiceDate: 1 }).lean(),
    resolveDetailReportMeta(query, Company),
    resolveCompanyContext(query),
    Company.find({}).select('name code').lean(),
  ]);
  const { reportNo, filename } = meta;
  const isBills = isBillsReport(query);

  const companyCodeByName = new Map(
    companies.map((c) => [c.name, c.code || c.name]),
  );
  const resolveCompanyCode = (name) => companyCodeByName.get(name) || name || '';

  const totals = { net: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, tds: 0, gross: 0 };
  const rows = entries.map((e, index) => {
    totals.net += e.netAmount || 0;
    totals.cgst += e.cgst || 0;
    totals.sgst += e.sgst || 0;
    totals.igst += e.igst || 0;
    totals.gst += e.totalGST || 0;
    totals.tds += e.tds || 0;
    totals.gross += e.grossAmount || 0;
    const companyCode = resolveCompanyCode(e.company);
    const base = [
      index + 1,
      formatExpenseType(e.expenseType),
      formatReportMonthLabel(e.month, { invoiceDate: e.invoiceDate, financialYear }),
      e.coNames || '',
      toLocationLabel(e.location),
      fmtDateDMY(e.invoiceDate),
      e.invoiceNo || '',
      e.headOfExpense || '',
      e.particulars || '',
      e.netAmount || 0,
      e.cgst || 0,
      e.sgst || 0,
      e.igst || 0,
      e.totalGST || 0,
      e.tds || 0,
      e.grossAmount || 0,
    ];
    if (isBills) {
      return [
        ...base,
        fmtDateDMY(e.dueDate || e.paymentDate),
        formatPaymentStatus(e.status),
        '',
      ];
    }
    return [
      ...base,
      companyCode,
      formatPaymentFrom(e),
      e.paymentMethod || e.merType || '',
      e.paymentRefNumber || '',
      fmtDateDMY(e.paymentDate),
    ];
  });

  const totalsRow = isBills
    ? [
      entries.length,
      '', '', '', '', '', '', '', '',
      totals.net,
      totals.cgst,
      totals.sgst,
      totals.igst,
      totals.gst,
      totals.tds,
      totals.gross,
      '', '', '',
    ]
    : [
      entries.length,
      '', '', '', '', '', '', '', '',
      totals.net,
      totals.cgst,
      totals.sgst,
      totals.igst,
      totals.gst,
      totals.tds,
      totals.gross,
      '', '', '', '', '',
    ];

  return {
    filename,
    reportNo,
    companyCtx,
    sheetName: formatMonthRangeAbbrev(query.month) || 'All Months',
    title: buildDetailTitle(query, companyCtx),
    totalsLabel: buildTotalsLabel(query, companyCtx),
    headers: isBills ? BILLS_DETAIL_HEADERS : DETAIL_HEADERS,
    rows,
    totalsRow,
    grandTotal: totals.gross,
    footerAddress: companyCtx.address,
    moneyColIndices: [9, 10, 11, 12, 13, 14, 15],
    gstColIndex: 13,
    tdsColIndex: 14,
    totalColIndex: 15,
    includeGrandTotal: false,
    includeAmountInWords: false,
  };
};

export const generateMonthlyExcel = async (query) => {
  const model = await buildMonthlyReportModel(query);
  const { filename, sheetName, ...sheet } = model;

  const workbook = createMerWorkbook();
  buildMerStyledSheet(workbook, { sheetName, ...sheet });

  return { workbook, filename };
};

export const generateMonthlyPdf = async (query) => {
  const model = await buildMonthlyReportModel(query);
  const { filename, sheetName, ...rest } = model;
  void sheetName;

  const html = buildMonthlyReportHtml(rest);
  const buffer = await renderHtmlToPdfBuffer(html);
  const pdfName = String(filename || 'MER-report.xlsx').replace(/\.xlsx$/i, '.pdf');

  return { buffer: Buffer.from(buffer), filename: pdfName };
};

export const generateSummaryExcel = async (query) => {
  const financialYear = query.financialYear || getFinancialYear();
  const [summary, headSummary, monthlyReport, companyCtx] = await Promise.all([
    getReportSummary(query),
    getExpenseHeadSummary(query),
    getMonthlyReport(query),
    resolveCompanyContext(query),
  ]);

  const workbook = createMerWorkbook();
  const footerAddress = companyCtx.address;

  buildMerStyledSheet(workbook, {
    sheetName: 'Summary',
    title: 'MER Summary Report',
    reportNo: '',
    headers: ['Metric', 'Value'],
    rows: [
      ['Total Net', summary.totalNetAmount],
      ['Total GST', summary.totalGST],
      ['Total TDS', summary.totalTDS],
      ['Gross Amount', summary.grossAmount],
      ['Entries', summary.entryCount],
      ['Vendors', summary.vendorCount],
    ],
    totalsRow: null,
    grandTotal: summary.grossAmount,
    footerAddress,
    companyCtx,
    moneyColIndices: [],
    includeGrandTotal: true,
    includeAmountInWords: true,
  });

  const headTotals = headSummary.reduce(
    (acc, h) => ({
      net: acc.net + (h.net || 0),
      gst: acc.gst + (h.gst || 0),
      tds: acc.tds + (h.tds || 0),
      gross: acc.gross + (h.gross || 0),
      count: acc.count + (h.count || 0),
    }),
    { net: 0, gst: 0, tds: 0, gross: 0, count: 0 },
  );

  buildMerStyledSheet(workbook, {
    sheetName: 'Expense Heads',
    title: 'MER Expense Head Report',
    reportNo: '',
    headers: ['Head', 'Net', 'GST', 'TDS', 'Gross', 'Count'],
    rows: headSummary.map((h) => [h._id, h.net, h.gst, h.tds, h.gross, h.count]),
    totalsRow: ['Totals', headTotals.net, headTotals.gst, headTotals.tds, headTotals.gross, headTotals.count],
    grandTotal: headTotals.gross,
    footerAddress,
    companyCtx,
    moneyColIndices: [1, 2, 3, 4],
    gstColIndex: 2,
    tdsColIndex: 3,
    totalColIndex: 4,
  });

  const monthlyCombined = monthlyReport.filter((m) => m.merType === 'combined');
  const monthlyTotals = monthlyCombined.reduce(
    (acc, m) => ({
      net: acc.net + (m.net || 0),
      gst: acc.gst + (m.gst || 0),
      tds: acc.tds + (m.tds || 0),
      gross: acc.gross + (m.gross || 0),
      count: acc.count + (m.count || 0),
    }),
    { net: 0, gst: 0, tds: 0, gross: 0, count: 0 },
  );

  buildMerStyledSheet(workbook, {
    sheetName: 'Monthly',
    title: 'MER Monthly Summary Report',
    reportNo: '',
    headers: ['Report No', 'Company', 'Month', 'Type', 'Net', 'GST', 'TDS', 'Gross', 'Entries'],
    rows: monthlyReport.map((m) => [
      m.reportNo || '',
      m.companyCode || m.company || '',
      formatReportMonthLabel(m.month, { financialYear }),
      m.merType || 'combined',
      m.net,
      m.gst,
      m.tds,
      m.gross,
      m.count,
    ]),
    totalsRow: [
      'Totals',
      '',
      '',
      '',
      monthlyTotals.net,
      monthlyTotals.gst,
      monthlyTotals.tds,
      monthlyTotals.gross,
      monthlyTotals.count,
    ],
    grandTotal: monthlyTotals.gross,
    footerAddress,
    companyCtx,
    moneyColIndices: [4, 5, 6, 7],
    textColIndices: [0],
    gstColIndex: 5,
    tdsColIndex: 6,
    totalColIndex: 7,
  });

  return workbook;
};
