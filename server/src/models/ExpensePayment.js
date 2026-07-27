import mongoose from 'mongoose';
import { ALL_PAYMENT_METHODS, MER_TYPES } from '../constants/paymentMethods.js';
import { PAYMENT_RECORD_STATUSES } from '../constants/paymentStatus.js';

const expensePaymentSchema = new mongoose.Schema(
  {
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, required: true },
    paymentMethod: { type: String, enum: ALL_PAYMENT_METHODS, required: true },
    paymentRefNumber: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    cardNumber: { type: String, trim: true },
    merType: { type: String, enum: MER_TYPES },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: PAYMENT_RECORD_STATUSES,
      default: 'Active',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidedAt: { type: Date },
  },
  { timestamps: true },
);

expensePaymentSchema.index({ expenseId: 1, status: 1, paymentDate: -1 });

export const ExpensePayment = mongoose.model('ExpensePayment', expensePaymentSchema);
