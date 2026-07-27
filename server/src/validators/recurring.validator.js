import { body, param } from 'express-validator';
import { ALL_PAYMENT_METHODS, MER_ENTRY_TYPES } from '../constants/paymentMethods.js';
import { EXPENSE_NATURES, RECURRING_FREQUENCIES } from '../constants/paymentStatus.js';

export const createRecurringValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('company').trim().notEmpty().withMessage('Company is required'),
  body('coNames').trim().notEmpty().withMessage('Co name is required'),
  body('headOfExpense').trim().notEmpty().withMessage('Head of expense is required'),
  body('expenseType').isIn(['Capital', 'Revenue']).withMessage('Invalid expense type'),
  body('expenseNature')
    .optional({ values: 'falsy' })
    .isIn(EXPENSE_NATURES)
    .withMessage('Nature must be Fixed or Variable'),
  body('netAmount').toFloat().isFloat({ min: 0 }).withMessage('Net amount is required'),
  body('dueDayOfMonth').optional({ values: 'falsy' }).toInt().isInt({ min: 1, max: 28 }).withMessage('Due day must be 1–28'),
  body('frequency')
    .optional({ values: 'falsy' })
    .isIn(RECURRING_FREQUENCIES)
    .withMessage('Invalid frequency'),
  body('startDate').optional({ values: 'falsy' }).isISO8601(),
  body('endDate').optional({ values: 'falsy' }).isISO8601(),
  body('nextDueDate').optional({ values: 'falsy' }).isISO8601(),
  body('merType').optional({ values: 'falsy' }).isIn(MER_ENTRY_TYPES),
  body('paymentMethod').optional({ values: 'falsy' }).isIn(ALL_PAYMENT_METHODS),
  body('gstPercent').optional({ values: 'falsy' }).toFloat(),
  body('tds').optional({ values: 'falsy' }).toFloat(),
  body('useIGST').optional({ values: 'falsy' }),
  body('location').optional({ values: 'falsy' }).trim(),
  body('particulars').optional({ values: 'falsy' }).trim(),
  body('vendor').optional({ values: 'falsy' }).trim(),
  body('notes').optional({ values: 'falsy' }).trim(),
];

export const updateRecurringValidator = [
  param('id').isMongoId().withMessage('Invalid template ID'),
  ...createRecurringValidator.map((rule) =>
    // reuse create rules but make core fields optional on update
    rule,
  ),
];

export const recurringIdValidator = [param('id').isMongoId().withMessage('Invalid template ID')];
