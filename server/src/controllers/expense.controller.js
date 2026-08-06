import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as expenseService from '../services/expense.service.js';
import * as recurringService from '../services/recurring.service.js';
import { Expense } from '../models/Expense.js';

export const getExpenses = asyncHandler(async (req, res) => {
  const result = await expenseService.getExpenses(req.query);
  return res.status(200).json({
    success: true,
    message: 'Success',
    data: result.expenses,
    pagination: result.pagination,
    summary: result.summary,
  });
});

export const getExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.params.id);
  ApiResponse.success(res, expense);
});

export const createExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.body, req.user);

  // A Fixed bill is recurring by definition: spin up a linked schedule from the entry.
  const isFixedRecurring = expense.expenseNature === 'Fixed'
    && !expense.isDraft
    && expense.frequency
    && expense.frequency !== 'One-time';
  let template = null;
  if (isFixedRecurring) {
    template = await recurringService.createTemplateFromExpense(expense, req.body, req.user);
    await Expense.updateOne({ _id: expense._id }, { recurringTemplateId: template._id });
    expense.recurringTemplateId = template._id;
  }

  ApiResponse.created(
    res,
    expense,
    template ? 'Bill created and recurring schedule set up' : 'Bill created and submitted for approval',
  );
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
