import { PAYMENT_STATUS } from '../../constants/paymentStatus.js';
import { Company } from '../../models/Company.js';
import { Location } from '../../models/Location.js';
import { toLocationLabel } from '../../utils/locationFormat.js';
import { parseMonthList } from '../../utils/merSerial.js';
import {
  resolveMonthlyReportMeta,
  resolveFyReportMeta,
  resolveCustomizedReportMeta,
} from '../../utils/merReportSerial.js';
import { normalizeReportScope, REPORT_SCOPE } from '../../utils/reportScope.js';

const DEFAULT_FOOTER_ADDRESS =
  '6th Floor, Suite No 608 And 609, Ashoka House, 3a, Hare St, B.b.d. Bagh, Kolkata, West Bengal, 700001, India';

export const resolveCompanyContext = async (query) => {
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

export const baseMatch = (filter) => ({
  ...filter,
  isDraft: { $ne: true },
  approvalStatus: 'Approved',
});

export const REPORT_MONEY_GROUP = {
  net: { $sum: '$netAmount' },
  gst: { $sum: '$totalGST' },
  tds: { $sum: '$tds' },
  gross: { $sum: '$grossAmount' },
  outstanding: { $sum: '$balanceDue' },
  amountPaid: { $sum: '$amountPaid' },
  count: { $sum: 1 },
};

export const pickMoney = (row = {}) => ({
  net: row.net || 0,
  gst: row.gst || 0,
  tds: row.tds || 0,
  gross: row.gross || 0,
  outstanding: row.outstanding || 0,
  amountPaid: row.amountPaid || 0,
  count: row.count || 0,
});

export const DUE_BUCKETS = [
  { key: 'overdue', name: 'Overdue' },
  { key: 'due_today', name: 'Due today' },
  { key: 'due_7', name: 'Due in 7 days' },
  { key: 'due_month', name: 'Due this month' },
  { key: 'later', name: 'Later' },
  { key: 'paid', name: 'Paid' },
];

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const dueAgingSwitch = (todayStart, todayEnd, in7, monthEnd) => ({
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

export const FY_MONTH_ORDER = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
];

export const sortMonthlyRows = (rows) =>
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

export const sortFyRows = (rows) =>
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

export const emptyTotals = () => ({
  net: 0, gst: 0, tds: 0, gross: 0, outstanding: 0, amountPaid: 0, count: 0,
});

export const resolveDetailReportMeta = async (query, Company) => {
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

export const previousFinancialYearLabel = (fy) => {
  const [startYear] = String(fy || '').split('-').map(Number);
  if (!startYear) return '';
  return `${startYear - 1}-${String(startYear).slice(-2)}`;
};

export const formatPaymentStatus = (status) => {
  if (status === PAYMENT_STATUS.PARTIALLY_PAID) return 'Partially Paid';
  if (status === PAYMENT_STATUS.HOLD) return 'On Hold';
  return status || PAYMENT_STATUS.PENDING;
};

export const formatExpenseType = (expenseType) => {
  if (expenseType === 'Capital') return 'CE';
  if (expenseType === 'Revenue') return 'RE';
  return expenseType || '';
};

/** Bank ac / card no, or Cash / UPI based on payment method. */
export const formatPaymentFrom = (expense) => {
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

export const isBillsReport = (query = {}) => normalizeReportScope(query.reportScope) === REPORT_SCOPE.DUE;

export const DETAIL_HEADERS = [
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

export const BILLS_DETAIL_HEADERS = [
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
