export const PAYMENT_METHOD_OPTIONS = ['Bank', 'Cash', 'UPI', 'Debit/Credit Card'];

/** MER type on new expense entries — bank or cash only. */
export const MER_ENTRY_TYPES = ['Bank', 'Cash'];

export const MER_ENTRY_TYPE_OPTIONS = MER_ENTRY_TYPES.map((value) => ({
  value,
  label: value,
}));

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

  const merType = MER_ENTRY_TYPES.includes(data.merType) ? data.merType : data.merType || null;

  if (merType) {
    return {
      merType,
      paymentMethod: data.paymentMethod || null,
    };
  }

  if (data.paymentMethod && PAYMENT_METHOD_OPTIONS.includes(data.paymentMethod)) {
    return { merType: null, paymentMethod: data.paymentMethod };
  }

  return { merType: null, paymentMethod: null };
};
