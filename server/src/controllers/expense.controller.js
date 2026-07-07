import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as expenseService from '../services/expense.service.js';

export const getExpenses = asyncHandler(async (req, res) => {
  const result = await expenseService.getExpenses(req.query);
  ApiResponse.paginated(res, result.expenses, result.pagination);
});

export const getExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.params.id);
  ApiResponse.success(res, expense);
});

export const createExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.body, req.user);
  ApiResponse.created(res, expense, 'MER entry created and submitted for approval');
});

export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.params.id, req.body, req.user);
  ApiResponse.success(res, expense, 'Expense updated');
});

export const deleteExpense = asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(req.params.id, req.user);
  ApiResponse.success(res, null, 'Expense deleted');
});

export const approveExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.approveExpense(req.params.id, req.user);
  ApiResponse.success(res, expense, 'MER entry approved');
});

export const completeExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.completeExpense(req.params.id, req.user);
  ApiResponse.success(res, expense, 'MER entry completed');
});

export const getNextSlNo = asyncHandler(async (req, res) => {
  const slNo = await expenseService.getNextSlNo({
    company: req.query.company,
    month: req.query.month,
    invoiceDate: req.query.invoiceDate,
    merType: req.query.merType,
  });
  ApiResponse.success(res, { slNo });
});

export const calculatePreview = asyncHandler(async (req, res) => {
  const calculated = expenseService.applyCalculations(req.body);
  ApiResponse.success(res, calculated);
});
