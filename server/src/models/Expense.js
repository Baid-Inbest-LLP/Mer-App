import mongoose from 'mongoose';
import { getFinancialYear } from '../config/index.js';
import { MER_TYPES, ALL_PAYMENT_METHODS } from '../constants/paymentMethods.js';

const expenseSchema = new mongoose.Schema(
  {
    slNo: { type: String, trim: true },
    month: { type: String, required: true },
    coNames: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    location: { type: String, trim: true },
    company: { type: String, trim: true },
    invoiceNo: { type: String, trim: true },
    monthlyInvoiceNumber: { type: String, trim: true },
    headOfExpense: { type: String, required: true },
    particulars: { type: String, trim: true },
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
    vendor: { type: String, trim: true },
    expenseType: { type: String, enum: ['Capital', 'Revenue'], required: true },
    netAmount: { type: Number, required: true, default: 0 },
    gstPercent: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalGST: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    grossAmount: { type: Number, default: 0 },
    paymentDate: { type: Date },
    paymentRefNumber: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    cardNumber: { type: String, trim: true },
    merType: { type: String, enum: MER_TYPES },
    paymentMethod: { type: String, enum: ALL_PAYMENT_METHODS },
    hasBillOrReceipt: { type: Boolean, default: false },
    useIGST: { type: Boolean, default: false },
    status: { type: String, enum: ['Paid', 'Pending', 'Cancelled'], default: 'Pending' },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Completed'],
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
expenseSchema.index({ isDraft: 1 });
expenseSchema.index({ invoiceNo: 'text', vendor: 'text', particulars: 'text', company: 'text' });

expenseSchema.pre('save', function setDerivedFields(next) {
  if (this.invoiceDate) {
    this.financialYear = getFinancialYear(this.invoiceDate);
    const month = new Date(this.invoiceDate).getMonth();
    const q = Math.floor(month / 3) + 1;
    this.quarter = `Q${q}`;
  }
  if (!this.month && this.invoiceDate) {
    this.month = new Date(this.invoiceDate).toLocaleString('en-US', { month: 'long' });
  }
  if (!this.merType && this.paymentMethod) {
    this.merType = this.paymentMethod === 'Cash' ? 'Cash' : 'Bank';
  }
  next();
});

export const Expense = mongoose.model('Expense', expenseSchema);
