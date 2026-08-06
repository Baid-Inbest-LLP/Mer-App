import { Router } from 'express';
import * as expenseController from '../controllers/expense.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createExpenseValidator, expenseIdValidator } from '../validators/expense.validator.js';
import {
  addPaymentValidator,
  autoPayValidator,
  holdStatusValidator,
  setAutoPayValidator,
  voidPaymentValidator,
} from '../validators/payment.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', expenseController.getExpenses);
router.get('/due', paymentController.getDueExpenses);
router.get('/next-slno', expenseController.getNextSlNo);
router.post('/calculate', expenseController.calculatePreview);

router.patch('/:id/approve', expenseIdValidator, validate, expenseController.approveExpense);
router.patch('/:id/complete', expenseIdValidator, validate, expenseController.completeExpense);

router.get('/:id/payments', expenseIdValidator, validate, paymentController.listPayments);
router.post('/:id/payments', addPaymentValidator, validate, paymentController.addPayment);
router.post(
  '/:id/payments/auto-pay',
  autoPayValidator,
  validate,
  paymentController.autoPay,
);
router.delete(
  '/:id/payments/:paymentId',
  voidPaymentValidator,
  validate,
  paymentController.voidPayment,
);
router.patch('/:id/hold', holdStatusValidator, validate, paymentController.setHold);
router.patch('/:id/auto-pay', setAutoPayValidator, validate, paymentController.setAutoPay);

router.get('/:id', expenseIdValidator, validate, expenseController.getExpense);
router.post('/', createExpenseValidator, validate, expenseController.createExpense);
router.put('/:id', expenseIdValidator, validate, expenseController.updateExpense);
router.delete('/:id', expenseIdValidator, validate, expenseController.deleteExpense);

export default router;
