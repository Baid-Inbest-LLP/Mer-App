import { OPEN_PAYMENT_STATUSES, PAYMENT_STATUS } from '../constants/paymentStatus.js';
import { Expense } from '../models/Expense.js';
import { Company } from '../models/Company.js';
import { Location } from '../models/Location.js';
import { buildExpenseQuery } from '../utils/queryBuilder.js';
import { getFinancialYear } from '../config/index.js';
import { formatReportMonthLabel, formatMonthRangeAbbrev, parseMonthList } from '../utils/merSerial.js';
import { toLocationLabel } from '../utils/locationFormat.js';
import {
  buildMonthlyReportNo,
  buildFyReportNo,
  resolveMonthlyReportMeta,
  resolveFyReportMeta,
  resolveCustomizedReportMeta,
} from '../utils/merReportSerial.js';
import { reportMerTypeAddFieldsStage, REPORT_MER_TYPES } from '../utils/reportMerType.js';
import { normalizeReportScope, REPORT_SCOPE } from '../utils/reportScope.js';
import {
  buildDetailTitle,
  buildTotalsLabel,
  buildMerStyledSheet,
  createMerWorkbook,
  fmtDateDMY,
} from '../utils/excelGenerator.js';
import { buildMonthlyReportHtml } from '../utils/pdfGenerator.js';
import { renderHtmlToPdfBuffer } from '../utils/puppeteerPdf.js';

const DEFAULT_FOOTER_ADDRESS =
  '6th Floor, Suite No 608 And 609, Ashoka House, 3a, Hare St, B.b.d. Bagh, Kolkata, West Bengal, 700001, India';

const resolveCompanyContext = async (query) => {
  if (!query.company) {
    return {
      companyCode: 'INBEST',
      companyName: '',
      taxId: '',
      phone: '',
      otherDetails: [],
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
      otherDetails: [],
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
    otherDetails: Array.isArray(company.otherDetails)
      ? company.otherDetails
        .map((d) => ({
          label: String(d?.label || '').trim(),
          value: String(d?.value || '').trim(),
        }))
        .filter((d) => d.label && d.value)
      : [],
    address: address || DEFAULT_FOOTER_ADDRESS,
  };
};

const baseMatch = (filter) => ({
  ...filter,
  isDraft: { $ne: true },
  approvalStatus: 'Approved',
});

const REPORT_MONEY_GROUP = {
  net: { $sum: '$netAmount' },
  gst: { $sum: '$totalGST' },
  tds: { $sum: '$tds' },
  gross: { $sum: '$grossAmount' },
  outstanding: { $sum: '$balanceDue' },
  amountPaid: { $sum: '$amountPaid' },
  count: { $sum: 1 },
};

const pickMoney = (row = {}) => ({
  net: row.net || 0,
  gst: row.gst || 0,
  tds: row.tds || 0,
  gross: row.gross || 0,
  outstanding: row.outstanding || 0,
  amountPaid: row.amountPaid || 0,
  count: row.count || 0,
});

const DUE_BUCKETS = [
  { key: 'overdue', name: 'Overdue' },
  { key: 'due_today', name: 'Due today' },
  { key: 'due_7', name: 'Due in 7 days' },
  { key: 'due_month', name: 'Due this month' },
  { key: 'later', name: 'Later' },
  { key: 'paid', name: 'Paid' },
];

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const dueAgingSwitch = (todayStart, todayEnd, in7, monthEnd) => ({
  $switch: {
    branches: [
      { case: { $eq: ['$status', PAYMENT_STATUS.PAID] }, then: 'paid' },
      {
        case: {
          $and: [
            { $ne: ['$dueDate', null] },
            { $lt: ['$dueDate', todayStart] },
          ],
        },
        then: 'overdue',
      },
      {
        case: { $and: [{ $gte: ['$dueDate', todayStart] }, { $lte: ['$dueDate', todayEnd] }] },
        then: 'due_today',
      },
      {
        case: { $and: [{ $gt: ['$dueDate', todayEnd] }, { $lte: ['$dueDate', in7] }] },
        then: 'due_7',
      },
      {
        case: { $and: [{ $gt: ['$dueDate', in7] }, { $lte: ['$dueDate', monthEnd] }] },
        then: 'due_month',
      },
    ],
    default: 'later',
  },
});

export const getReportSummary = async (query) => {
  const filter = buildExpenseQuery(query);
  const match = baseMatch(filter);
  const isExpenses = normalizeReportScope(query.reportScope) === REPORT_SCOPE.EXPENSES;
  const billsMatch = isExpenses
    ? baseMatch(buildExpenseQuery({ ...query, reportScope: REPORT_SCOPE.DUE }))
    : match;

  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const in7 = endOfDay(new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000));
  const monthEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0));

  const [facetRows, vendorCount, cashPaidRows] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalNet: { $sum: '$netAmount' },
                totalGST: { $sum: '$totalGST' },
                totalTDS: { $sum: '$tds' },
                grossAmount: { $sum: '$grossAmount' },
                outstanding: { $sum: '$balanceDue' },
                amountPaid: { $sum: '$amountPaid' },
                dueAndOverdue: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', OPEN_PAYMENT_STATUSES] },
                      '$balanceDue',
                      0,
                    ],
                  },
                },
                openCount: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', OPEN_PAYMENT_STATUSES] },
                      1,
                      0,
                    ],
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
          byBucket: [
            {
              $group: {
                _id: dueAgingSwitch(todayStart, todayEnd, in7, monthEnd),
                outstanding: { $sum: '$balanceDue' },
                amountPaid: { $sum: '$amountPaid' },
                gross: { $sum: '$grossAmount' },
                count: { $sum: 1 },
              },
            },
          ],
          dueThisMonth: [
            {
              $match: {
                status: { $in: OPEN_PAYMENT_STATUSES },
                dueDate: { $gte: todayStart, $lte: monthEnd },
              },
            },
            {
              $group: {
                _id: null,
                outstanding: { $sum: '$balanceDue' },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$vendor' } },
      { $count: 'vendors' },
    ]),
    isExpenses
      ? Expense.aggregate([
          { $match: billsMatch },
          { $group: { _id: null, amountPaid: { $sum: '$amountPaid' } } },
        ])
      : Promise.resolve([]),
  ]);

  const facet = facetRows[0] || {};
  const totals = facet.totals?.[0] || {};
  const bucketMap = Object.fromEntries(
    (facet.byBucket || []).map((row) => [row._id, row]),
  );
  const buckets = DUE_BUCKETS.map((meta) => {
    const row = bucketMap[meta.key] || {};
    return {
      key: meta.key,
      name: meta.name,
      value: meta.key === 'paid' ? (row.gross || row.amountPaid || 0) : (row.outstanding || 0),
      count: row.count || 0,
    };
  });

  const cashPaid = cashPaidRows[0]?.amountPaid;
  // Expense Gross = money actually paid on the same bills (incl. partials),
  // matching the Bills "Paid" card — not only fully-settled invoice gross.
  const grossAmount = isExpenses
    ? (cashPaid || 0)
    : (totals.grossAmount || 0);

  return {
    totalNetAmount: totals.totalNet || 0,
    totalGST: totals.totalGST || 0,
    totalTDS: totals.totalTDS || 0,
    grossAmount,
    outstanding: totals.outstanding || 0,
    amountPaid: isExpenses ? (cashPaid || 0) : (totals.amountPaid || 0),
    dueAndOverdue: totals.dueAndOverdue || 0,
    openCount: totals.openCount || 0,
    entryCount: totals.count || 0,
    vendorCount: vendorCount[0]?.vendors || 0,
    overdue: buckets.find((b) => b.key === 'overdue')?.value || 0,
    dueToday: buckets.find((b) => b.key === 'due_today')?.value || 0,
    dueIn7: buckets.find((b) => b.key === 'due_7')?.value || 0,
    dueThisMonth: facet.dueThisMonth?.[0]?.outstanding || 0,
    buckets,
  };
};

export const getExpenseHeadSummary = async (query) => {
  const filter = buildExpenseQuery(query);
  return Expense.aggregate([
    { $match: baseMatch(filter) },
    {
      $group: {
        _id: '$headOfExpense',
        ...REPORT_MONEY_GROUP,
      },
    },
    { $sort: { outstanding: -1, gross: -1 } },
  ]);
};

const FY_MONTH_ORDER = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
];

const sortMonthlyRows = (rows) =>
  rows.sort((a, b) => {
    const monthDiff = FY_MONTH_ORDER.indexOf(a.month) - FY_MONTH_ORDER.indexOf(b.month);
    if (monthDiff !== 0) return monthDiff;
    const companyDiff = String(a.companyCode || a.company || '').localeCompare(
      String(b.companyCode || b.company || ''),
    );
    if (companyDiff !== 0) return companyDiff;
    const typeOrder = { bank: 0, cash: 1, combined: 2 };
    return (typeOrder[a.merType] ?? 9) - (typeOrder[b.merType] ?? 9);
  });


const emptyTotals = () => ({
  net: 0, gst: 0, tds: 0, gross: 0, outstanding: 0, amountPaid: 0, count: 0,
});

const resolveDetailReportMeta = async (query, Company) => {
  const months = parseMonthList(query.month);
  if (query.company && months.length === 1) {
    return resolveMonthlyReportMeta({ ...query, month: months[0] }, Company);
  }
  if (months.length > 1) {
    return resolveCustomizedReportMeta(query, Company);
  }
  if (query.company && query.financialYear) {
    return resolveFyReportMeta(query, Company);
  }
  return resolveCustomizedReportMeta(query, Company);
};

export const getMonthlyReport = async (query) => {
  const filter = buildExpenseQuery(query);
  const financialYear = query.financialYear || getFinancialYear();

  const [typedRows, combinedRows, companies] = await Promise.all([
    Expense.aggregate([
      { $match: baseMatch(filter) },
      reportMerTypeAddFieldsStage,
      {
        $group: {
          _id: { company: '$company', month: '$month', merType: '$reportMerType' },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Expense.aggregate([
      { $match: baseMatch(filter) },
      {
        $group: {
          _id: { company: '$company', month: '$month' },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Company.find({ isActive: { $ne: false } }).select('name code').lean(),
  ]);

  const codeByName = Object.fromEntries(
    companies.filter((c) => c.name && c.code).map((c) => [c.name, c.code]),
  );

  const statsByKey = new Map();

  for (const row of combinedRows) {
    if (!row._id?.company || !row._id?.month) continue;
    const key = `${row._id.company}|${row._id.month}`;
    statsByKey.set(`${key}|combined`, {
      company: row._id.company,
      month: row._id.month,
      merType: 'combined',
      ...pickMoney(row),
    });
  }

  for (const row of typedRows) {
    if (!row._id?.company || !row._id?.month) continue;
    const merType = row._id.merType;
    if (merType !== 'bank' && merType !== 'cash') continue;
    const key = `${row._id.company}|${row._id.month}|${merType}`;
    statsByKey.set(key, {
      company: row._id.company,
      month: row._id.month,
      merType,
      ...pickMoney(row),
    });
  }

  const companyMonths = [...statsByKey.values()]
    .filter((row) => row.merType === 'combined')
    .map((row) => ({ company: row.company, month: row.month }));

  const mapped = [];

  for (const { company, month } of companyMonths) {
    const companyCode = codeByName[company] || '';
    const prefix = `${company}|${month}`;

    for (const merType of REPORT_MER_TYPES) {
      const stats = statsByKey.get(`${prefix}|${merType}`) || {
        ...emptyTotals(),
        company,
        month,
        merType,
      };

      mapped.push({
        company,
        month,
        companyCode,
        merType,
        ...pickMoney(stats),
        reportNo: buildMonthlyReportNo({
          companyCode,
          month,
          financialYear,
          merType,
          reportScope: query.reportScope,
        }),
      });
    }
  }

  return sortMonthlyRows(mapped);
};

const sortFyRows = (rows) =>
  rows.sort((a, b) => {
    const fyDiff = String(b.financialYear || '').localeCompare(String(a.financialYear || ''));
    if (fyDiff !== 0) return fyDiff;
    const companyDiff = String(a.companyCode || a.company || '').localeCompare(
      String(b.companyCode || b.company || ''),
    );
    if (companyDiff !== 0) return companyDiff;
    const typeOrder = { bank: 0, cash: 1, combined: 2 };
    return (typeOrder[a.merType] ?? 9) - (typeOrder[b.merType] ?? 9);
  });

export const getFinancialYearReport = async (query) => {
  const filter = buildExpenseQuery(query);

  const [typedRows, combinedRows, companies] = await Promise.all([
    Expense.aggregate([
      { $match: baseMatch(filter) },
      reportMerTypeAddFieldsStage,
      {
        $group: {
          _id: {
            company: '$company',
            financialYear: '$financialYear',
            merType: '$reportMerType',
          },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Expense.aggregate([
      { $match: baseMatch(filter) },
      {
        $group: {
          _id: { company: '$company', financialYear: '$financialYear' },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Company.find({ isActive: { $ne: false } }).select('name code').lean(),
  ]);

  const codeByName = Object.fromEntries(
    companies.filter((c) => c.name && c.code).map((c) => [c.name, c.code]),
  );

  const statsByKey = new Map();

  for (const row of combinedRows) {
    if (!row._id?.company || !row._id?.financialYear) continue;
    const key = `${row._id.company}|${row._id.financialYear}`;
    statsByKey.set(`${key}|combined`, {
      company: row._id.company,
      financialYear: row._id.financialYear,
      merType: 'combined',
      ...pickMoney(row),
    });
  }

  for (const row of typedRows) {
    if (!row._id?.company || !row._id?.financialYear) continue;
    const merType = row._id.merType;
    if (merType !== 'bank' && merType !== 'cash') continue;
    const key = `${row._id.company}|${row._id.financialYear}|${merType}`;
    statsByKey.set(key, {
      company: row._id.company,
      financialYear: row._id.financialYear,
      merType,
      ...pickMoney(row),
    });
  }

  const companyYears = [...statsByKey.values()]
    .filter((row) => row.merType === 'combined')
    .map((row) => ({ company: row.company, financialYear: row.financialYear }));

  const mapped = [];

  for (const { company, financialYear } of companyYears) {
    const companyCode = codeByName[company] || '';
    const prefix = `${company}|${financialYear}`;

    for (const merType of REPORT_MER_TYPES) {
      const stats = statsByKey.get(`${prefix}|${merType}`) || {
        ...emptyTotals(),
        company,
        financialYear,
        merType,
      };

      mapped.push({
        company,
        financialYear,
        companyCode,
        merType,
        ...pickMoney(stats),
        reportNo: buildFyReportNo({
          companyCode,
          financialYear,
          merType,
          reportScope: query.reportScope,
        }),
      });
    }
  }

  return sortFyRows(mapped);
};

const previousFinancialYearLabel = (fy) => {
  const [startYear] = String(fy || '').split('-').map(Number);
  if (!startYear) return '';
  return `${startYear - 1}-${String(startYear).slice(-2)}`;
};

export const getMonthlyDetailedReport = async (query) => {
  const filter = buildExpenseQuery(query);

  const docs = await Expense.find(baseMatch(filter))
    .sort({ invoiceDate: 1 })
    .lean();

  const todayStart = startOfDay();
  const openStatuses = new Set(OPEN_PAYMENT_STATUSES);
  const totals = {
    net: 0,
    gst: 0,
    tds: 0,
    gross: 0,
    amountPaid: 0,
    outstanding: 0,
    overdue: 0,
    due: 0,
    byQuarter: {},
  };
  const entries = docs.map((e) => {
    const gross = e.grossAmount || 0;
    const paid = e.amountPaid || 0;
    const balance = e.balanceDue || 0;
    totals.net += e.netAmount || 0;
    totals.gst += e.totalGST || 0;
    totals.tds += e.tds || 0;
    totals.gross += gross;
    totals.amountPaid += paid;
    totals.outstanding += balance;

    const quarter = e.quarter || '';
    if (quarter) {
      totals.byQuarter[quarter] = (totals.byQuarter[quarter] || 0) + gross;
    }

    if (openStatuses.has(e.status)) {
      const dueDate = e.dueDate ? new Date(e.dueDate) : null;
      if (dueDate && dueDate < todayStart) {
        totals.overdue += balance;
      } else {
        totals.due += balance;
      }
    }

    return {
      _id: e._id,
      slNo: e.slNo || '',
      invoiceDate: e.invoiceDate || null,
      dueDate: e.dueDate || null,
      month: e.month || '',
      quarter: e.quarter || '',
      company: e.company || '',
      coNames: e.coNames || '',
      headOfExpense: e.headOfExpense || '',
      particulars: e.particulars || '',
      expenseType: e.expenseType || '',
      expenseNature: e.expenseNature || '',
      netAmount: e.netAmount || 0,
      totalGST: e.totalGST || 0,
      tds: e.tds || 0,
      grossAmount: gross,
      amountPaid: paid,
      balanceDue: balance,
      status: e.status || '',
      paymentMethod: e.paymentMethod || e.merType || '',
      paymentDate: e.paymentDate || null,
      approvalStatus: e.approvalStatus || '',
    };
  });

  let previousYearGross = 0;
  const prevFy = previousFinancialYearLabel(query.financialYear);
  if (prevFy) {
    const prevFilter = buildExpenseQuery({ ...query, financialYear: prevFy });
    const prevAgg = await Expense.aggregate([
      { $match: baseMatch(prevFilter) },
      { $group: { _id: null, gross: { $sum: '$grossAmount' } } },
    ]);
    previousYearGross = prevAgg[0]?.gross || 0;
  }

  return {
    ...(await resolveDetailReportMeta(query, Company)),
    entries,
    totals,
    previousYearGross,
    count: entries.length,
  };
};

const DETAIL_HEADERS = [
  'Sl\nNo',
  'Exp\nType',
  'Month',
  'Co\nName',
  'Loc',
  'Invoice\nDate',
  'Invoice\nNo',
  'Head of\nExp',
  'Particulars',
  'Net\nAmt',
  'CGST',
  'SGST',
  'IGST',
  'Total\nGST',
  'TDS',
  'Gross\nAmt',
  'Paid\nBy',
  'Payment\nFrom',
  'Payment\nMethod',
  'Payment\nRef No',
  'Payment\nDate',
];

const BILLS_DETAIL_HEADERS = [
  'Sl\nNo',
  'Exp\nType',
  'Month',
  'Co\nName',
  'Loc',
  'Invoice\nDate',
  'Invoice\nNo',
  'Head of\nExp',
  'Particulars',
  'Net\nAmt',
  'CGST',
  'SGST',
  'IGST',
  'Total\nGST',
  'TDS',
  'Gross\nAmt',
  'Date',
  'Payment\nStatus',
  'Remarks',
];

const isBillsReport = (query = {}) => normalizeReportScope(query.reportScope) === REPORT_SCOPE.DUE;

const formatPaymentStatus = (status) => {
  if (status === PAYMENT_STATUS.PARTIALLY_PAID) return 'Partially Paid';
  if (status === PAYMENT_STATUS.HOLD) return 'On Hold';
  return status || PAYMENT_STATUS.PENDING;
};

const formatExpenseType = (expenseType) => {
  if (expenseType === 'Capital') return 'CE';
  if (expenseType === 'Revenue') return 'RE';
  return expenseType || '';
};

/** Bank ac / card no, or Cash / UPI based on payment method. */
const formatPaymentFrom = (expense) => {
  const method = String(expense.paymentMethod || expense.merType || '').trim();
  const normalized = method.toLowerCase();

  if (normalized === 'cash') return 'Cash';
  if (normalized === 'upi') return 'UPI';
  if (normalized === 'card' || normalized === 'debit/credit card') {
    return expense.cardNumber || '';
  }
  if (['neft', 'rtgs', 'imps', 'bank'].includes(normalized)) {
    return expense.bankAccountNumber || '';
  }
  if (expense.bankAccountNumber) return expense.bankAccountNumber;
  if (expense.cardNumber) return expense.cardNumber;
  return method || '';
};

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
