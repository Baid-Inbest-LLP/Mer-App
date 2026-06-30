export const PAYMENT_METHODS = ['Bank', 'Cash', 'UPI', 'Debit/Credit Card'];

export const MER_TYPES = [...PAYMENT_METHODS];

export const MER_PAYMENT_MISMATCH_MESSAGE = 'MER type and payment method must match';

export const merTypeMatchesPaymentMethod = (merType, paymentMethod) =>
  Boolean(merType && paymentMethod && merType === paymentMethod);

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
