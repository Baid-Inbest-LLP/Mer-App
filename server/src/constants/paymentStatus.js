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

export const MONEY_EPSILON = 0.01;

export const roundMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};
