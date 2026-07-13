export const PAYMENT_METHOD_OPTIONS = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Card', 'Cash'];

/** Older values that may still exist on saved expenses. */
export const LEGACY_PAYMENT_METHODS = ['Bank', 'Debit/Credit Card'];

/** MER type on new expense entries — bank or cash only. */
export const MER_ENTRY_TYPES = ['Bank', 'Cash'];

export const MER_ENTRY_TYPE_OPTIONS = MER_ENTRY_TYPES.map((value) => ({
  value,
  label: value,
}));

/** Build select options from lookup lists; keep current value if missing (legacy rows). */
const withCurrentOption = (options, current) => {
  if (!current || options.some((opt) => opt.value === current)) return options;
  return [{ value: current, label: current }, ...options];
};

const toSelectOptions = (values = []) =>
  (values || []).filter(Boolean).map((value) => ({ value, label: value }));

export const getFromAccountOptions = (current, bankAccounts = []) =>
  withCurrentOption(toSelectOptions(bankAccounts), current);

export const getCardNumberOptions = (current, cards = []) =>
  withCurrentOption(toSelectOptions(cards), current);

export const PAYMENT_METHOD_RULES = {
  UPI: {
    requiresBankAccount: false,
    requiresPaymentRef: true,
    paymentRefLabel: 'UPI Transaction ID',
    paymentRefMessage: 'UPI transaction ID is required',
    paymentRefPlaceholder: 'Enter UPI reference / UTR',
  },
  NEFT: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
    bankAccountLabel: 'From Account',
    paymentRefLabel: 'NEFT UTR Number',
    bankAccountMessage: 'From account is required (e.g. ICICI - 2404)',
    paymentRefMessage: 'NEFT UTR number is required',
    bankAccountPlaceholder: 'e.g. ICICI - 2404',
    paymentRefPlaceholder: 'Enter NEFT UTR',
  },
  RTGS: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
    bankAccountLabel: 'From Account',
    paymentRefLabel: 'RTGS UTR Number',
    bankAccountMessage: 'From account is required (e.g. ICICI - 2404)',
    paymentRefMessage: 'RTGS UTR number is required',
    bankAccountPlaceholder: 'e.g. ICICI - 2404',
    paymentRefPlaceholder: 'Enter RTGS UTR',
  },
  IMPS: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
    bankAccountLabel: 'From Account',
    paymentRefLabel: 'IMPS UTR Number',
    bankAccountMessage: 'From account is required (e.g. ICICI - 2404)',
    paymentRefMessage: 'IMPS UTR number is required',
    bankAccountPlaceholder: 'e.g. ICICI - 2404',
    paymentRefPlaceholder: 'Enter IMPS UTR / reference',
  },
  Card: {
    requiresBankAccount: false,
    requiresPaymentRef: true,
    requiresCardNumber: true,
    cardNumberLabel: 'Card No',
    cardNumberMessage: 'Card number is required (e.g. ICICI - 2404)',
    cardNumberPlaceholder: 'e.g. ICICI - 2404',
    paymentRefLabel: 'Card Transaction Reference',
    paymentRefMessage: 'Card transaction reference is required',
    paymentRefPlaceholder: 'Auth code / approval code',
  },
  Cash: {
    requiresBankAccount: false,
    requiresPaymentRef: false,
    paymentRefLabel: 'Payment Reference (optional)',
    paymentRefPlaceholder: 'Receipt or voucher number',
  },
  // Legacy
  Bank: {
    requiresBankAccount: true,
    requiresPaymentRef: true,
    bankAccountLabel: 'From Account',
    paymentRefLabel: 'Payment Ref / UTR Number',
    bankAccountMessage: 'From account is required (e.g. ICICI - 2404)',
    paymentRefMessage: 'Payment reference number is required',
    bankAccountPlaceholder: 'e.g. ICICI - 2404',
    paymentRefPlaceholder: 'Enter NEFT/RTGS/IMPS UTR',
  },
  'Debit/Credit Card': {
    requiresBankAccount: false,
    requiresPaymentRef: true,
    requiresCardNumber: true,
    cardNumberLabel: 'Card No',
    cardNumberMessage: 'Card number is required (e.g. ICICI - 2404)',
    cardNumberPlaceholder: 'e.g. ICICI - 2404',
    paymentRefLabel: 'Card Transaction Reference',
    paymentRefMessage: 'Card transaction reference is required',
    paymentRefPlaceholder: 'Auth code / approval code',
  },
};

export const getPaymentMethodRules = (method) =>
  PAYMENT_METHOD_RULES[method] || PAYMENT_METHOD_RULES.Cash;

/** Normalize issuer + last 4 to "ISSUER - 1234" (e.g. ICICI - 2404). */
export const formatIssuerLast4 = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const match = raw.match(/^(.+?)\s*[-–—]?\s*(\d{4})$/);
  if (match) {
    const issuer = match[1].trim().replace(/\s+/g, ' ').toUpperCase();
    return `${issuer} - ${match[2]}`;
  }

  return raw.replace(/\s+/g, ' ').toUpperCase();
};

export const formatCardNumber = formatIssuerLast4;

export const normalizeExpensePaymentFields = (data) => {
  if (!data) return { merType: null, paymentMethod: null };

  const merType = MER_ENTRY_TYPES.includes(data.merType) ? data.merType : data.merType || null;
  const knownMethods = [...PAYMENT_METHOD_OPTIONS, ...LEGACY_PAYMENT_METHODS];

  if (merType) {
    return {
      merType,
      paymentMethod: data.paymentMethod || null,
    };
  }

  if (data.paymentMethod && knownMethods.includes(data.paymentMethod)) {
    return { merType: null, paymentMethod: data.paymentMethod };
  }

  return { merType: null, paymentMethod: null };
};
