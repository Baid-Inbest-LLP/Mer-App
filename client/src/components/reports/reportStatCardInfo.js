/** Hover-help copy for report / insight stat cards. Keep short and plain. */

export const BILLS_MONTHLY_INFO = {
  billingAmount: 'Total value of all bills this period',
  noOfBills: 'Number of bills this period',
  paid: 'Amount already paid, including partials',
  overdue: 'Unpaid amount past the due date',
  upcomingDues: 'Unpaid amount not yet overdue',
};

export const BILLS_SUMMARY_INFO = {
  totalOutstanding: 'Total unpaid balance',
  overdueAmount: 'Unpaid amount past due date',
  openBills: 'Bills still unpaid',
  collectionRate: 'Share of billed amount collected',
};

export const EXPENSES_SUMMARY_INFO = {
  netExpense: 'Expense before GST and TDS',
  noOfExpenses: 'Number of paid expenses',
  gstPaid: 'Total GST on paid expenses',
  tdsDeducted: 'Total TDS on paid expenses',
  grossExpense: 'Cash paid this period, including partials',
};

/** Detail / customized views where Gross is invoice gross of listed rows. */
export const EXPENSES_DETAIL_INFO = {
  ...EXPENSES_SUMMARY_INFO,
  grossExpense: 'Total invoice value of listed expenses',
};

export const FY_INFO = {
  fyTotalExpense: 'Total paid expenses this financial year',
  fyBillingAmount: 'Total billed amount this financial year',
  totalEntries: 'Number of paid expenses this year',
  totalFyBills: 'Number of bills this financial year',
  peakQuarter: 'Highest-spend quarter this year',
  yoyChange: 'Change vs last financial year',
};

export const DASHBOARD_INFO = {
  fyBillingAmount: 'Total Billed (Paid & Unpaid) Amount this FY',
  fyExpense: 'Total Expenses (Paid Bills) this FY',
  yearlyChange: 'Expense Change vs last FY',
  monthlyChange: 'Expense Change vs last Month',
  collectionRate: 'Share of Billed Amount Collected this FY',
  thisMonthExpense: 'Expenses (Paid Bills) this Month',
  paidThisMonth: 'Bill Paid this Month',
  overdue: 'Unpaid Amount past the Due Date on Open Bills',
  pendingPayment: 'Bills pending for payment',
  pendingApprovals: 'Bills Waiting for Approval',
};

