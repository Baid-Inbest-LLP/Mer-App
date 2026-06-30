import { Router } from 'express';
import * as expenseController from '../controllers/expense.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createExpenseValidator, expenseIdValidator } from '../validators/expense.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', expenseController.getExpenses);
router.get('/next-slno', expenseController.getNextSlNo);
router.post('/calculate', expenseController.calculatePreview);
router.patch('/:id/approve', expenseIdValidator, validate, expenseController.approveExpense);
router.patch('/:id/complete', expenseIdValidator, validate, expenseController.completeExpense);
router.get('/:id', expenseIdValidator, validate, expenseController.getExpense);
router.post('/', createExpenseValidator, validate, expenseController.createExpense);
router.put('/:id', expenseIdValidator, validate, expenseController.updateExpense);
router.delete('/:id', expenseIdValidator, validate, expenseController.deleteExpense);

export default router;
