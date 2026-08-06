import { body, param } from 'express-validator';
import {
  MER_ENTRY_TYPES,
  ALL_PAYMENT_METHODS,
  requiresBankAccount,
  requiresPaymentRef,
  requiresCardNumber,
} from '../constants/paymentMethods.js';
import { RECURRING_FREQUENCIES, FIXED_FREQUENCIES, AMOUNT_TYPES } from '../constants/paymentStatus.js';

const isDraftRequest = (req) => req.body?.isDraft === true || req.body?.isDraft === 'true';

const isFixedBill = (req) => req.body?.expenseNature === 'Fixed';

const isVariableBill = (req) => !isFixedBill(req);

const isUsageAmount = (req) => req.body?.amountType === 'Usage';

const isFixedAmountRequired = (req) => {
  if (isDraftRequest(req)) return false;
  // Usage-based Fixed bills may start at 0 until actual usage is known.
  if (isFixedBill(req) && isUsageAmount(req)) return false;
  return true;
};

const isRecordingPayment = (req) => {
  if (isDraftRequest(req)) return false;
  return req.body?.recordPaymentNow === true
    || req.body?.recordPaymentNow === 'true'
    || Boolean(req.body?.paymentDate);
};

const paymentReferenceRules = [
  body('bankAccountNumber').custom((value, { req }) => {
    if (!isRecordingPayment(req)) return true;
    if (!requiresBankAccount(req.body.paymentMethod)) return true;
    if (!value?.trim()) throw new Error('From account is required (e.g. ICICI - 2404)');
    return true;
  }),
  body('paymentRefNumber').custom((value, { req }) => {
    if (!isRecordingPayment(req)) return true;
    if (!requiresPaymentRef(req.body.paymentMethod)) return true;
    if (!value?.trim()) throw new Error('Payment reference is required for the selected payment method');
    return true;
  }),
  body('cardNumber').custom((value, { req }) => {
    if (!isRecordingPayment(req)) return true;
    if (!requiresCardNumber(req.body.paymentMethod)) return true;
    if (!value?.trim()) throw new Error('Card number is required (e.g. ICICI - 2404)');
    return true;
  }),
];

const paymentStatusRule = body('status')
  .optional({ values: 'falsy' })
  .isIn(['Paid', 'Pending', 'PartiallyPaid', 'Hold', 'Cancelled'])
  .withMessage('Payment status must be Paid, Pending, PartiallyPaid, Hold, or Cancelled');

const sharedBodyRules = [
  body('month').optional({ values: 'falsy' }).trim().notEmpty().withMessage('Month is required'),
  body('location').optional({ values: 'falsy' }).trim(),
  body('coNames')
    .optional({ values: 'falsy' })
    .trim()
    .notEmpty()
    .withMessage('Co name is required'),
  body('company').optional({ values: 'falsy' }).trim(),
  body('invoiceNo').optional({ values: 'falsy' }).trim(),
  body('monthlyInvoiceNumber').optional({ values: 'falsy' }).trim(),
  body('particulars').optional({ values: 'falsy' }).trim(),
  body('notes').optional({ values: 'falsy' }).trim(),
  body('terms').optional({ values: 'falsy' }).trim(),
  body('vendor').optional({ values: 'falsy' }).trim(),
  body('invoiceDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid invoice date is required'),
  body('paymentDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid payment date is required'),
  body('dueDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('expenseNature')
    .optional({ values: 'falsy' })
    .isIn(['Fixed', 'Variable'])
    .withMessage('Invalid expense nature'),
  body('amountType')
    .optional({ values: 'falsy' })
    .isIn(AMOUNT_TYPES)
    .withMessage('Invalid amount type'),
  body('frequency')
    .optional({ values: 'falsy' })
    .isIn(RECURRING_FREQUENCIES)
    .withMessage('Invalid expense frequency'),
  body('initialPaymentAmount').optional({ values: 'falsy' }).toFloat(),
  body('paymentAmount').optional({ values: 'falsy' }).toFloat(),
  body('recordPaymentNow').optional({ values: 'falsy' }),
  body('autoPay').optional({ values: 'falsy' }),
  body('autoPayCardNumber').optional({ values: 'falsy' }).trim(),
  body('headOfExpense')
    .optional({ values: 'falsy' })
    .trim()
    .notEmpty()
    .withMessage('Head of expense is required'),
  body('expenseType')
    .optional({ values: 'falsy' })
    .isIn(['Capital', 'Revenue'])
    .withMessage('Invalid expense type'),
  body('netAmount')
    .optional({ values: 'falsy' })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage('Net amount must be a positive number'),
  body('gstPercent').optional({ values: 'falsy' }).toFloat(),
  body('gstAmount').optional({ values: 'falsy' }).toFloat(),
  body('tds').optional({ values: 'falsy' }).toFloat(),
  body('cgst').optional({ values: 'falsy' }).toFloat(),
  body('sgst').optional({ values: 'falsy' }).toFloat(),
  body('igst').optional({ values: 'falsy' }).toFloat(),
  body('totalGST').optional({ values: 'falsy' }).toFloat(),
  body('grossAmount').optional({ values: 'falsy' }).toFloat(),
  body('paymentMethod')
    .optional({ values: 'falsy' })
    .isIn(ALL_PAYMENT_METHODS)
    .withMessage('Invalid payment method'),
  body('merType')
    .optional({ values: 'falsy' })
    .isIn(MER_ENTRY_TYPES)
    .withMessage('Invalid MER type'),
  paymentStatusRule,
  body('useIGST').optional({ values: 'falsy' }),
  body('hasBillOrReceipt').optional({ values: 'falsy' }),
  body('isDraft').optional({ values: 'falsy' }),
  body('paymentRefNumber').optional({ values: 'falsy' }).trim(),
  body('bankAccountNumber').optional({ values: 'falsy' }).trim(),
  body('cardNumber').optional({ values: 'falsy' }).trim(),
  body('purchaseOrderId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid purchase order ID'),
  body('poNumber').optional({ values: 'falsy' }).trim(),
  body('source').optional({ values: 'falsy' }).isIn(['manual', 'purchase_order', 'recurring']),
];

export const createExpenseValidator = [
  body('isDraft').optional({ values: 'falsy' }),
  body('month')
    .if((_, { req }) => !isDraftRequest(req))
    .trim()
    .notEmpty()
    .withMessage('Month is required'),
  body('coNames')
    .if((_, { req }) => !isDraftRequest(req))
    .trim()
    .notEmpty()
    .withMessage('Co name is required'),
  body('invoiceDate')
    .if((_, { req }) => !isDraftRequest(req) && isVariableBill(req))
    .isISO8601()
    .withMessage('Valid invoice date is required'),
  body('invoiceDate')
    .if((_, { req }) => !isDraftRequest(req) && isFixedBill(req))
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid invoice date is required'),
  body('invoiceDate')
    .if((_, { req }) => isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid invoice date is required'),
  body('invoiceNo')
    .if((_, { req }) => !isDraftRequest(req) && isVariableBill(req))
    .trim()
    .notEmpty()
    .withMessage('Invoice number is required'),
  body('invoiceNo')
    .if((_, { req }) => !isDraftRequest(req) && isFixedBill(req))
    .optional({ values: 'falsy' })
    .trim(),
  body('headOfExpense')
    .if((_, { req }) => !isDraftRequest(req))
    .trim()
    .notEmpty()
    .withMessage('Head of expense is required'),
  body('expenseType')
    .if((_, { req }) => !isDraftRequest(req))
    .notEmpty()
    .withMessage('Expense type is required')
    .isIn(['Capital', 'Revenue'])
    .withMessage('Invalid expense type'),
  body('expenseType')
    .if((_, { req }) => isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isIn(['Capital', 'Revenue'])
    .withMessage('Invalid expense type'),
  body('netAmount')
    .if((_, { req }) => isFixedAmountRequired(req))
    .toFloat()
    .isFloat({ min: 0.01 })
    .withMessage('Net amount is required'),
  body('netAmount')
    .if((_, { req }) => !isFixedAmountRequired(req))
    .optional({ values: 'falsy' })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage('Net amount must be a positive number'),
  body('amountType')
    .if((_, { req }) => !isDraftRequest(req) && isFixedBill(req))
    .notEmpty()
    .withMessage('Amount type is required for fixed bills')
    .isIn(AMOUNT_TYPES)
    .withMessage('Invalid amount type'),
  body('amountType')
    .if((_, { req }) => isDraftRequest(req) || isVariableBill(req))
    .optional({ values: 'falsy' })
    .isIn(AMOUNT_TYPES)
    .withMessage('Invalid amount type'),
  body('paymentMethod')
    .if((_, { req }) => !isDraftRequest(req))
    .custom((value, { req }) => {
      const recording = req.body?.recordPaymentNow === true
        || req.body?.recordPaymentNow === 'true'
        || Boolean(req.body?.paymentDate);
      if (!recording) return true;
      if (!value) throw new Error('Payment method is required when recording a payment');
      return true;
    })
    .optional({ values: 'falsy' })
    .isIn(ALL_PAYMENT_METHODS)
    .withMessage('Invalid payment method'),
  body('paymentMethod')
    .if((_, { req }) => isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isIn(ALL_PAYMENT_METHODS)
    .withMessage('Invalid payment method'),
  body('merType')
    .if((_, { req }) => !isDraftRequest(req))
    .notEmpty()
    .withMessage('MER type is required')
    .isIn(MER_ENTRY_TYPES)
    .withMessage('Invalid MER type'),
  body('merType')
    .if((_, { req }) => isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isIn(MER_ENTRY_TYPES)
    .withMessage('Invalid MER type'),
  body('dueDate')
    .if((_, { req }) => !isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('dueDate')
    .if((_, { req }) => isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('expenseNature')
    .if((_, { req }) => !isDraftRequest(req))
    .notEmpty()
    .withMessage('Bill nature is required')
    .isIn(['Fixed', 'Variable'])
    .withMessage('Invalid expense nature'),
  body('expenseNature')
    .if((_, { req }) => isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isIn(['Fixed', 'Variable'])
    .withMessage('Invalid expense nature'),
  body('recurringDueDay')
    .if((_, { req }) => !isDraftRequest(req) && isFixedBill(req))
    .notEmpty()
    .withMessage('Due day of month is required')
    .toInt()
    .isInt({ min: 1, max: 28 })
    .withMessage('Due day must be between 1 and 28'),
  // Nature drives recurrence: Fixed must be recurring, Variable must be one-time.
  body('frequency')
    .if((_, { req }) => !isDraftRequest(req))
    .custom((value, { req }) => {
      const nature = req.body?.expenseNature;
      if (nature === 'Fixed') {
        if (!value || !FIXED_FREQUENCIES.includes(value)) {
          throw new Error(`A fixed bill must recur (${FIXED_FREQUENCIES.join(', ')})`);
        }
      } else if (nature === 'Variable') {
        if (value && value !== 'One-time') {
          throw new Error('A variable bill must be one-time');
        }
      } else if (value && !RECURRING_FREQUENCIES.includes(value)) {
        throw new Error('Invalid expense frequency');
      }
      return true;
    }),
  body('frequency')
    .if((_, { req }) => isDraftRequest(req))
    .optional({ values: 'falsy' })
    .isIn(RECURRING_FREQUENCIES)
    .withMessage('Invalid expense frequency'),
  body('initialPaymentAmount').optional({ values: 'falsy' }).toFloat(),
  body('paymentAmount').optional({ values: 'falsy' }).toFloat(),
  body('recordPaymentNow').optional({ values: 'falsy' }),
  body('autoPay').optional({ values: 'falsy' }),
  body('autoPayCardNumber').optional({ values: 'falsy' }).trim(),
  body('scheduleName').optional({ values: 'falsy' }).trim(),
  body('recurringDueDay')
    .if((_, { req }) => isDraftRequest(req) || isVariableBill(req))
    .optional({ values: 'falsy' })
    .toInt()
    .isInt({ min: 1, max: 28 })
    .withMessage('Due day must be between 1 and 28'),
  body('recurringStartDate').optional({ values: 'falsy' }).isISO8601().withMessage('Valid start date is required'),
  body('recurringEndDate').optional({ values: 'falsy' }).isISO8601().withMessage('Valid end date is required'),
  body('purchaseOrderId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid purchase order ID'),
  body('poNumber').optional({ values: 'falsy' }).trim(),
  body('source').optional({ values: 'falsy' }).isIn(['manual', 'purchase_order', 'recurring']),
  ...paymentReferenceRules,
  paymentStatusRule,
  body('location').optional({ values: 'falsy' }).trim(),
  body('gstPercent').optional({ values: 'falsy' }).toFloat(),
  body('gstAmount').optional({ values: 'falsy' }).toFloat(),
  body('tds').optional({ values: 'falsy' }).toFloat(),
  body('useIGST').optional({ values: 'falsy' }),
  body('hasBillOrReceipt').optional({ values: 'falsy' }),
];

export const updateExpenseValidator = [
  param('id').isMongoId().withMessage('Invalid expense ID'),
  body('invoiceDate')
    .if((_, { req }) => isVariableBill(req))
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid invoice date is required')
    .custom((value) => {
      if (!value) throw new Error('Invoice date is required');
      return true;
    }),
  body('invoiceDate')
    .if((_, { req }) => isFixedBill(req))
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid invoice date is required'),
  body('invoiceNo')
    .if((_, { req }) => isVariableBill(req))
    .trim()
    .notEmpty()
    .withMessage('Invoice number is required'),
  body('invoiceNo')
    .if((_, { req }) => isFixedBill(req))
    .optional({ values: 'falsy' })
    .trim(),
  body('dueDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Valid due date is required'),
  ...sharedBodyRules,
  ...paymentReferenceRules,
];

export const expenseIdValidator = [param('id').isMongoId().withMessage('Invalid expense ID')];
