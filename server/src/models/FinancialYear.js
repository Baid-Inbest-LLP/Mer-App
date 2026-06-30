import mongoose from 'mongoose';

const financialYearSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const FinancialYear = mongoose.model('FinancialYear', financialYearSchema);
