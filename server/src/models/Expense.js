import mongoose from 'mongoose';
import { getFinancialYear } from '../config/index.js';
import { MER_TYPES, ALL_PAYMENT_METHODS } from '../constants/paymentMethods.js';
import {
  EXPENSE_NATURES,
  AMOUNT_TYPES,
  PAYMENT_STATUSES,
  RECURRING_FREQUENCIES,
  FIXED_FREQUENCIES,
} from '../constants/paymentStatus.js';

const expenseSchema = new mongoose.Schema(
  {
    slNo: { type: String, trim: true },
    month: { type: String, required: true },
    coNames: { type: String, required: true, trim: true },
    invoiceDate: { type: Date },
    /** When payment is expected; used by Due Bills board. */
    dueDate: { type: Date },
    location: { type: String, trim: true },
    company: { type: String, trim: true },
    invoiceNo: { type: String, trim: true },
    monthlyInvoiceNumber: { type: String, trim: true },
    headOfExpense: { type: String, required: true },
    particulars: { type: String, trim: true },
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
    vendor: { type: String, trim: true },
    /** Linked PO-Software purchase order (external id as string). */
    purchaseOrderId: { type: String, trim: true },
    poNumber: { type: String, trim: true },
    source: {
      type: String,
      enum: ['manual', 'purchase_order', 'recurring'],
      default: 'manual',
    },
    recurringTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringExpenseTemplate',
      default: null,
    },
    expenseType: { type: String, enum: ['Capital', 'Revenue'], required: true },
    expenseNature: {
      type: String,
      enum: EXPENSE_NATURES,
      default: 'Variable',
    },
    /** Fixed bills only: Fixed = same amount each period; Usage = amount varies (e.g. AWS). */
    amountType: {
      type: String,
      enum: AMOUNT_TYPES,
      default: 'Fixed',
    },
    /** How often this bill/expense recurs (informational on the entry; templates own scheduling). */
    frequency: {
      type: String,
      enum: RECURRING_FREQUENCIES,
      default: 'One-time',
    },
    netAmount: { type: Number, required: true, default: 0 },
    gstPercent: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalGST: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    grossAmount: { type: Number, default: 0 },
    /** Cached sum of active ExpensePayment rows. */
    amountPaid: { type: Number, default: 0 },
    /** Cached grossAmount - amountPaid (never negative). */
    balanceDue: { type: Number, default: 0 },
    /** Mirrored from latest active payment for list/report convenience. */
    paymentDate: { type: Date },
    paymentRefNumber: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    cardNumber: { type: String, trim: true },
    merType: { type: String, enum: MER_TYPES },
    paymentMethod: { type: String, enum: ALL_PAYMENT_METHODS },
    /**
     * Fixed bills only: when true, settle the full billed amount by credit card
     * (on demand from Payments, and automatically when a recurring instance is generated).
     */
    autoPay: { type: Boolean, default: false },
    /** Card display value used for auto-pay (e.g. "HDFC - 1234"). */
    autoPayCardNumber: { type: String, trim: true },
    hasBillOrReceipt: { type: Boolean, default: false },
    useIGST: { type: Boolean, default: false },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    approvalStatus: {
      type: String,
      // Pending → Completed (admin) → Approved (superadmin)
      enum: ['Pending', 'Completed', 'Approved'],
      default: 'Pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    invoiceCopy: {
      filename: String,
      originalName: String,
      mimetype: String,
      path: String,
      size: Number,
    },
    financialYear: { type: String },
    quarter: { type: String },
    isDraft: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

expenseSchema.index({ slNo: 1 }, { unique: true, sparse: true });
expenseSchema.index({ invoiceDate: -1 });
expenseSchema.index({ financialYear: 1, month: 1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ approvalStatus: 1 });
expenseSchema.index({ vendor: 1 });
expenseSchema.index({ company: 1 });
expenseSchema.index({ headOfExpense: 1 });
expenseSchema.index({ merType: 1 });
expenseSchema.index({ paymentMethod: 1 });
expenseSchema.index({ expenseType: 1 });
expenseSchema.index({ expenseNature: 1 });
expenseSchema.index({ dueDate: 1 });
expenseSchema.index({ status: 1, dueDate: 1 });
expenseSchema.index({ isDraft: 1 });
expenseSchema.index({ recurringTemplateId: 1 }, { sparse: true });
expenseSchema.index({ purchaseOrderId: 1 }, { unique: true, sparse: true });
expenseSchema.index({ poNumber: 1 }, { sparse: true });
expenseSchema.index({ invoiceNo: 'text', vendor: 'text', particulars: 'text', company: 'text' });

expenseSchema.pre('save', function setDerivedFields(next) {
  const anchorDate = this.invoiceDate || this.dueDate;
  if (anchorDate) {
    this.financialYear = getFinancialYear(anchorDate);
    const month = new Date(anchorDate).getMonth();
    const q = Math.floor(month / 3) + 1;
    this.quarter = `Q${q}`;
  }
  if (!this.month && anchorDate) {
    this.month = new Date(anchorDate).toLocaleString('en-US', { month: 'long' });
  }
  // Due date applies to recurring (Fixed) bills only; do not copy from billing date.
  if (!this.merType && this.paymentMethod) {
    this.merType = this.paymentMethod === 'Cash' ? 'Cash' : 'Bank';
  }
  // Nature drives recurrence: Variable is always one-time; Fixed must be recurring.
  if (this.expenseNature === 'Variable') {
    this.frequency = 'One-time';
  } else if (this.expenseNature === 'Fixed') {
    if (!this.frequency || !FIXED_FREQUENCIES.includes(this.frequency)) {
      this.frequency = 'Monthly';
    }
  }
  if (this.isNew && (this.balanceDue == null || this.balanceDue === 0) && !this.amountPaid) {
    this.amountPaid = this.amountPaid || 0;
    this.balanceDue = Math.max(0, (this.grossAmount || 0) - (this.amountPaid || 0));
  }
  next();
});

export const Expense = mongoose.model('Expense', expenseSchema);
