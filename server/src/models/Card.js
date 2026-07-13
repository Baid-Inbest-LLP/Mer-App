import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    companyName: { type: String, trim: true },
    issuer: { type: String, required: true, trim: true, uppercase: true },
    last4: { type: String, required: true, trim: true, match: /^\d{4}$/ },
    cardType: { type: String, enum: ['Credit', 'Debit'], default: 'Credit' },
    label: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

cardSchema.index({ issuer: 1, last4: 1 }, { unique: true });
cardSchema.index({ isActive: 1 });
cardSchema.index({ company: 1 });

cardSchema.virtual('displayValue').get(function displayValue() {
  return `${this.issuer} - ${this.last4}`;
});

cardSchema.set('toJSON', { virtuals: true });
cardSchema.set('toObject', { virtuals: true });

export const Card = mongoose.model('Card', cardSchema);
