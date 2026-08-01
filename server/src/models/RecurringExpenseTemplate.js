import mongoose from 'mongoose';
import { ALL_PAYMENT_METHODS, MER_TYPES } from '../constants/paymentMethods.js';
import { EXPENSE_NATURES, AMOUNT_TYPES, RECURRING_FREQUENCIES } from '../constants/paymentStatus.js';

const recurringExpenseTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    coNames: { type: String, required: true, trim: true },
    headOfExpense: { type: String, required: true, trim: true },
    particulars: { type: String, trim: true },
    vendor: { type: String, trim: true },
    expenseType: { type: String, enum: ['Capital', 'Revenue'], required: true },
    expenseNature: {
      type: String,
      enum: EXPENSE_NATURES,
      default: 'Fixed',
    },
    amountType: {
      type: String,
      enum: AMOUNT_TYPES,
      default: 'Fixed',
    },
    netAmount: { type: Number, required: true, default: 0 },
    gstPercent: { type: Number, default: 0 },
    useIGST: { type: Boolean, default: false },
    tds: { type: Number, default: 0 },
    merType: { type: String, enum: MER_TYPES },
    paymentMethod: { type: String, enum: ALL_PAYMENT_METHODS },
    frequency: {
      type: String,
      enum: RECURRING_FREQUENCIES,
      default: 'Monthly',
    },
    /** Day of month the obligation is due (1–28). Used for Monthly / Quarterly / Half-yearly / Yearly. */
    dueDayOfMonth: { type: Number, required: true, min: 1, max: 28, default: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    nextDueDate: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

recurringExpenseTemplateSchema.index({ isActive: 1, nextDueDate: 1 });
recurringExpenseTemplateSchema.index({ company: 1, name: 1 });

export const RecurringExpenseTemplate = mongoose.model(
  'RecurringExpenseTemplate',
  recurringExpenseTemplateSchema,
);
