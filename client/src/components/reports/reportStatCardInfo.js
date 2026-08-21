/** Hover-help copy for report / insight stat cards. Keep short and plain. */

export const BILLS_MONTHLY_INFO = {
  billingAmount: 'Total Billed (Paid & Unpaid) Amount this Month',
  noOfBills: 'Number of Bills this Month',
  paid: 'Amount Paid on Bills this Month, including Partials',
  overdue: 'Unpaid Amount past the Due Date',
  upcomingDue: 'Unpaid Amount not yet Overdue',
};

export const BILLS_SUMMARY_INFO = {
  totalOutstanding: 'Total unpaid balance',
  overdueAmount: 'Unpaid amount past due date',
  openBills: 'Bills still unpaid',
  collectionRate: 'Share of billed amount collected',
};

export const EXPENSES_SUMMARY_INFO = {
  grossExpense: 'Cash Paid this Month, including Partials ',
  noOfExpenses: 'Number of Fully Paid Expenses this Month',
  netExpense: 'Net Amount of Fully Paid Expenses (before GST & TDS)',
  gstPaid: 'Total GST on Fully Paid Expenses this Month',
  tdsDeducted: 'Total TDS Deducted on Fully Paid Expenses this Month',
};

/** Detail / customized views where Gross is invoice gross of listed rows. */
export const EXPENSES_DETAIL_INFO = {
  ...EXPENSES_SUMMARY_INFO,
  grossExpense: 'Total Invoice Value of Listed Expenses',
};

export const FY_INFO = {
  fyTotalExpense: 'Total Expenses (Paid Bills) this FY',
  fyBillingAmount: 'Total Billed (Paid & Unpaid) Amount this FY',
  totalEntries: 'Number of Fully Paid Expenses this FY',
  totalFyBills: 'Number of Bills this FY',
  peakQuarter: 'Highest-Spend Quarter this FY',
  yoyChange: 'Expense Change vs last FY',
  yoyChangeBills: 'Billing Amount Change vs last FY',
  paymentRate: 'Share of FY Billed Amount Paid',
};

export const DASHBOARD_INFO = {
  fyBillingAmount: 'Total Billed (Paid & Unpaid) Amount this FY',
  fyExpense: 'Total Expenses (Paid Bills) this FY',
  yearlyChange: 'Expense Change vs last FY',
  monthlyChange: 'Expense Change vs last Month',
  paymentRate: 'Share of This Month\'s Billed Amount Paid',
  thisMonthExpense: 'Expenses (Paid Bills) this Month',
  paidThisMonth: 'Bill Paid this Month',
  overdue: 'Unpaid Amount past the Due Date on Open Bills',
  pendingPayment: 'Bills pending for payment',
  pendingApprovals: 'Bills Waiting for Approval',
};

