import { body, param } from 'express-validator';
import { ALL_PAYMENT_METHODS, MER_ENTRY_TYPES } from '../constants/paymentMethods.js';

export const addPaymentValidator = [
  param('id').isMongoId().withMessage('Invalid expense ID'),
  body('amount').toFloat().isFloat({ gt: 0 }).withMessage('Payment amount must be greater than zero'),
  body('paymentDate').isISO8601().withMessage('Valid payment date is required'),
  body('paymentMethod')
    .trim()
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(ALL_PAYMENT_METHODS)
    .withMessage('Invalid payment method'),
  body('merType').optional({ values: 'falsy' }).isIn(MER_ENTRY_TYPES),
  body('paymentRefNumber').optional({ values: 'falsy' }).trim(),
  body('bankAccountNumber').optional({ values: 'falsy' }).trim(),
  body('cardNumber').optional({ values: 'falsy' }).trim(),
  body('notes').optional({ values: 'falsy' }).trim(),
];

export const voidPaymentValidator = [
  param('id').isMongoId().withMessage('Invalid expense ID'),
  param('paymentId').isMongoId().withMessage('Invalid payment ID'),
];

export const holdStatusValidator = [
  param('id').isMongoId().withMessage('Invalid expense ID'),
  body('hold').optional({ values: 'falsy' }),
];
