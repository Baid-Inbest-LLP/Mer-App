export const PAYMENT_METHOD_OPTIONS = ['Bank', 'Cash', 'UPI', 'Debit/Credit Card'];

const MER_TYPE_LABELS = {
  Bank: 'Bank MER',
  Cash: 'Cash MER',
  UPI: 'UPI MER',
  'Debit/Credit Card': 'Debit/Credit Card MER',
};

export const MER_TYPE_OPTIONS = PAYMENT_METHOD_OPTIONS.map((value) => ({
  value,
  label: MER_TYPE_LABELS[value] || `${value} MER`,
}));

export const MER_PAYMENT_MISMATCH_MESSAGE = 'MER type and payment method must match';

export const merTypeMatchesPaymentMethod = (merType, paymentMethod) =>
  Boolean(merType && paymentMethod && merType === paymentMethod);

export const PAYMENT_METHOD_RULES = {
  Bank: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
    bankAccountLabel: 'Bank Account Number',
    paymentRefLabel: 'Payment Ref / UTR Number',
    bankAccountMessage: 'Bank account number is required',
    paymentRefMessage: 'Payment reference number is required',
    bankAccountPlaceholder: 'Enter beneficiary account number',
    paymentRefPlaceholder: 'Enter NEFT/RTGS/IMPS UTR',
  },
  UPI: {
    requiresBankAccount: false,
    requiresPaymentRef: true,
    paymentRefLabel: 'UPI Transaction ID',
    paymentRefMessage: 'UPI transaction ID is required',
    paymentRefPlaceholder: 'Enter UPI reference / UTR',
  },
  'Debit/Credit Card': {
    requiresBankAccount: false,
    requiresPaymentRef: true,
    paymentRefLabel: 'Card Transaction Reference',
    paymentRefMessage: 'Card transaction reference is required',
    paymentRefPlaceholder: 'Auth code or last 4 digits',
  },
  Cash: {
    requiresBankAccount: false,
    requiresPaymentRef: false,
    paymentRefLabel: 'Payment Reference (optional)',
    paymentRefPlaceholder: 'Receipt or voucher number',
  },
};

export const getPaymentMethodRules = (method) =>
  PAYMENT_METHOD_RULES[method] || PAYMENT_METHOD_RULES.Cash;

export const normalizeExpensePaymentFields = (data) => {
  if (!data) return { merType: null, paymentMethod: null };

  if (data.merType) {
    return {
      merType: data.merType,
      paymentMethod: data.paymentMethod || data.merType,
    };
  }

  if (data.paymentMethod && PAYMENT_METHOD_OPTIONS.includes(data.paymentMethod)) {
    return { merType: data.paymentMethod, paymentMethod: data.paymentMethod };
  }

  return { merType: null, paymentMethod: null };
};
