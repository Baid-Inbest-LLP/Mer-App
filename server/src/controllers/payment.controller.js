import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as paymentService from '../services/payment.service.js';
import * as dueExpenseService from '../services/dueExpense.service.js';

export const listPayments = asyncHandler(async (req, res) => {
  const payments = await paymentService.listPaymentsForExpense(req.params.id);
  ApiResponse.success(res, payments);
});

export const addPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.addPayment(req.params.id, req.body, req.user);
  ApiResponse.created(res, result, 'Payment recorded');
});

export const voidPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.voidPayment(
    req.params.id,
    req.params.paymentId,
    req.user,
  );
  ApiResponse.success(res, result, 'Payment voided');
});

export const setHold = asyncHandler(async (req, res) => {
  const hold = req.body?.hold !== false && req.body?.hold !== 'false';
  const expense = await paymentService.setHoldStatus(req.params.id, hold, req.user);
  ApiResponse.success(res, expense, hold ? 'Expense put on hold' : 'Hold released');
});

export const getDueExpenses = asyncHandler(async (req, res) => {
  const result = await dueExpenseService.getDueExpenses(req.query);
  return res.status(200).json({
    success: true,
    message: 'Success',
    data: result.expenses,
    pagination: result.pagination,
    summary: result.summary,
  });
});
