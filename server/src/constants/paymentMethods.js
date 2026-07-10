/** Payment methods available on new expense entries. */
export const PAYMENT_METHODS = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Card', 'Cash'];

/** Older values that may still exist on saved expenses. */
export const LEGACY_PAYMENT_METHODS = ['Bank', 'Debit/Credit Card'];

/** Allowed by schema / validators (new + legacy). */
export const ALL_PAYMENT_METHODS = [...PAYMENT_METHODS, ...LEGACY_PAYMENT_METHODS];

/** MER type on new expense entries — bank or cash only. */
export const MER_ENTRY_TYPES = ['Bank', 'Cash'];

export const MER_TYPES = [...MER_ENTRY_TYPES];

export const PAYMENT_METHOD_RULES = {
  UPI: {
    requiresBankAccount: false,
    requiresPaymentRef: true,
  },
  NEFT: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
  },
  RTGS: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
  },
  IMPS: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
  },
  Card: {
    requiresBankAccount: false,
    requiresPaymentRef: true,
    requiresCardNumber: true,
  },
  Cash: {
    requiresBankAccount: false,
    requiresPaymentRef: false,
  },
  // Legacy
  Bank: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
  },
  'Debit/Credit Card': {
    requiresBankAccount: false,
    requiresPaymentRef: true,
    requiresCardNumber: true,
  },
};

export const getPaymentMethodRules = (method) =>
  PAYMENT_METHOD_RULES[method] || PAYMENT_METHOD_RULES.Cash;

export const requiresBankAccount = (method) =>
  Boolean(getPaymentMethodRules(method).requiresBankAccount);

export const requiresPaymentRef = (method) =>
  Boolean(getPaymentMethodRules(method).requiresPaymentRef);

export const requiresCardNumber = (method) =>
  Boolean(getPaymentMethodRules(method).requiresCardNumber);
