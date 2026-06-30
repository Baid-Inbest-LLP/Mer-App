import { Expense } from '../models/Expense.js';
import { Company } from '../models/Company.js';
import { Location } from '../models/Location.js';
import { buildExpenseQuery } from '../utils/queryBuilder.js';
import { getFinancialYear } from '../config/index.js';
import { toLocationLabel } from '../utils/locationFormat.js';
import {
  buildMonthlyReportNo,
  resolveCustomizedReportMeta,
} from '../utils/merReportSerial.js';
import {
  buildDetailTitle,
  buildMerStyledSheet,
  buildMetaPairsFromQuery,
  createMerWorkbook,
  fmtDateDMY,
} from '../utils/excelGenerator.js';

const DEFAULT_FOOTER_ADDRESS =
  '6th Floor, Suite No 608 And 609, Ashoka House, 3a, Hare St, B.b.d. Bagh, Kolkata, West Bengal, 700001, India';

const resolveCompanyContext = async (query) => {
  if (!query.company) {
    return {
      companyCode: 'INBEST',
      companyName: '',
      taxId: '',
      phone: '',
      address: DEFAULT_FOOTER_ADDRESS,
    };
  }

  const company = await Company.findOne({ name: query.company }).lean();
  if (!company) {
    return {
      companyCode: 'INBEST',
      companyName: query.company,
      taxId: '',
      phone: '',
      address: DEFAULT_FOOTER_ADDRESS,
    };
  }

  let address = company.address || '';
  const locationLabel = query.location ? toLocationLabel(query.location) : null;

  if (company._id) {
    const locQuery = { company: company._id };
    if (locationLabel) {
      const loc = await Location.findOne({ ...locQuery, label: locationLabel }).lean();
      if (loc) {
        address = [loc.street, loc.city, loc.state, loc.zipCode, loc.country].filter(Boolean).join(', ');
      }
    }
    if (!address) {
      const defaultLoc = await Location.findOne({ ...locQuery, isDefault: true }).lean()
        || await Location.findOne(locQuery).lean();
      if (defaultLoc) {
        address = [defaultLoc.street, defaultLoc.city, defaultLoc.state, defaultLoc.zipCode, defaultLoc.country]
          .filter(Boolean)
          .join(', ');
      }
    }
  }

  return {
    companyCode: company.code || company.name,
    companyName: company.name,
    taxId: company.taxId || '',
    phone: company.phone || '',
    address: address || DEFAULT_FOOTER_ADDRESS,
  };
};

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

const DETAIL_HEADERS = [
  'S.No',
  'Expense No',
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
];

export const generateMonthlyExcel = async (query) => {
  const filter = buildExpenseQuery(query);

  const [entries, { reportNo, filename }, companyCtx] = await Promise.all([
    Expense.find(baseMatch(filter)).sort({ invoiceDate: 1 }).lean(),
    resolveCustomizedReportMeta(query, Company),
    resolveCompanyContext(query),
  ]);

  const totals = { net: 0, gst: 0, tds: 0, gross: 0 };
  const rows = entries.map((e, index) => {
    totals.net += e.netAmount || 0;
    totals.gst += e.totalGST || 0;
    totals.tds += e.tds || 0;
    totals.gross += e.grossAmount || 0;
    return [
      index + 1,
      e.slNo || '',
      fmtDateDMY(e.invoiceDate),
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
    ];
  });

  const totalsRow = [
    '',
    'Totals',
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
  ];

  const workbook = createMerWorkbook();
  const monthLabel = query.month || 'All Months';

  buildMerStyledSheet(workbook, {
    sheetName: monthLabel,
    title: buildDetailTitle(query),
    reportNo,
    metaPairs: buildMetaPairsFromQuery(query, companyCtx),
    headers: DETAIL_HEADERS,
    rows,
    totalsRow,
    grandTotal: totals.gross,
    footerAddress: companyCtx.address,
    companyCtx,
    moneyColIndices: [9, 10, 11, 12],
    gstColIndex: 10,
    tdsColIndex: 11,
    totalColIndex: 12,
  });

  return { workbook, filename };
};

export const generateSummaryExcel = async (query) => {
  const [summary, headSummary, monthlyReport, companyCtx] = await Promise.all([
    getReportSummary(query),
    getExpenseHeadSummary(query),
    getMonthlyReport(query),
    resolveCompanyContext(query),
  ]);

  const workbook = createMerWorkbook();
  const metaPairs = buildMetaPairsFromQuery(query, companyCtx);
  const footerAddress = companyCtx.address;

  buildMerStyledSheet(workbook, {
    sheetName: 'Summary',
    title: 'MER Summary Report',
    reportNo: '',
    metaPairs,
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
    metaPairs,
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

  const monthlyTotals = monthlyReport.reduce(
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
    metaPairs,
    headers: ['Report No', 'Month', 'Net', 'GST', 'TDS', 'Gross', 'Entries'],
    rows: monthlyReport.map((m) => [
      m.reportNo || '',
      m._id,
      m.net,
      m.gst,
      m.tds,
      m.gross,
      m.count,
    ]),
    totalsRow: [
      'Totals',
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
    moneyColIndices: [2, 3, 4, 5],
    textColIndices: [0],
    gstColIndex: 3,
    tdsColIndex: 4,
    totalColIndex: 5,
  });

  return workbook;
};
