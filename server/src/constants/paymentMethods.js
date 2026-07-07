export const PAYMENT_METHODS = ['Bank', 'Cash', 'UPI', 'Debit/Credit Card'];

/** MER type on new expense entries — bank or cash only. */
export const MER_ENTRY_TYPES = ['Bank', 'Cash'];

export const MER_TYPES = [...MER_ENTRY_TYPES];

export const PAYMENT_METHOD_RULES = {
  Bank: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
  },
  UPI: {
    requiresBankAccount: false,
    requiresPaymentRef: true,
  },
  'Debit/Credit Card': {
    requiresBankAccount: false,
    requiresPaymentRef: true,
  },
  Cash: {
    requiresBankAccount: false,
    requiresPaymentRef: false,
  },
};

export const getPaymentMethodRules = (method) =>
  PAYMENT_METHOD_RULES[method] || PAYMENT_METHOD_RULES.Cash;

export const requiresBankAccount = (method) =>
  Boolean(getPaymentMethodRules(method).requiresBankAccount);

export const requiresPaymentRef = (method) =>
  Boolean(getPaymentMethodRules(method).requiresPaymentRef);
