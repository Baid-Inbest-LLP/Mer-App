/** Payment / settlement status on an expense (bill). Separate from approvalStatus. */
export const PAYMENT_STATUSES = ['Pending', 'PartiallyPaid', 'Paid', 'Hold', 'Cancelled'];

export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  PARTIALLY_PAID: 'PartiallyPaid',
  PAID: 'Paid',
  HOLD: 'Hold',
  CANCELLED: 'Cancelled',
};

/** Open (still owing) statuses used by Due Bills board. */
export const OPEN_PAYMENT_STATUSES = [
  PAYMENT_STATUS.PENDING,
  PAYMENT_STATUS.PARTIALLY_PAID,
  PAYMENT_STATUS.HOLD,
];

export const EXPENSE_NATURES = ['Fixed', 'Variable'];

export const EXPENSE_NATURE = {
  FIXED: 'Fixed',
  VARIABLE: 'Variable',
};

/** For Fixed (recurring) bills: constant amount vs usage-based (e.g. AWS). */
export const AMOUNT_TYPES = ['Fixed', 'Usage'];

export const AMOUNT_TYPE = {
  FIXED: 'Fixed',
  USAGE: 'Usage',
};

export const PAYMENT_RECORD_STATUSES = ['Active', 'Voided'];

export const RECURRING_FREQUENCIES = [
  'One-time',
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Half-yearly',
  'Yearly',
];

/** Frequencies allowed for a Fixed (recurring) bill. Variable bills are always One-time. */
export const FIXED_FREQUENCIES = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly'];

export const MONEY_EPSILON = 0.01;

/** Round money to 2 decimal places (paise). Gross uses Math.round separately. */
export const roundMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};
