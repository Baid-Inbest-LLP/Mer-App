import { OPEN_PAYMENT_STATUSES } from '../../constants/paymentStatus.js';
import { Expense } from '../../models/Expense.js';
import { Company } from '../../models/Company.js';
import { buildExpenseQuery } from '../../utils/queryBuilder.js';
import {
  baseMatch,
  startOfDay,
  resolveDetailReportMeta,
  previousFinancialYearLabel,
} from './reportShared.js';

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
