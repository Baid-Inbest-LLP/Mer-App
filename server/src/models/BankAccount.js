import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    companyName: { type: String, trim: true },
    bankName: { type: String, required: true, trim: true, uppercase: true },
    last4: { type: String, required: true, trim: true, match: /^\d{4}$/ },
    accountName: { type: String, trim: true, default: '' },
    label: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

bankAccountSchema.index({ bankName: 1, last4: 1 }, { unique: true });
bankAccountSchema.index({ isActive: 1 });
bankAccountSchema.index({ company: 1 });

bankAccountSchema.virtual('displayValue').get(function displayValue() {
  return `${this.bankName} - ${this.last4}`;
});

bankAccountSchema.set('toJSON', { virtuals: true });
bankAccountSchema.set('toObject', { virtuals: true });

export const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
