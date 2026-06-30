import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    label: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

locationSchema.index({ company: 1, label: 1 }, { unique: true });

export const Location = mongoose.model('Location', locationSchema);
