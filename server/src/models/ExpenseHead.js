import mongoose from 'mongoose';

const expenseHeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    category: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ExpenseHead = mongoose.model('ExpenseHead', expenseHeadSchema);
