import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    taxId: { type: String, trim: true },
    website: { type: String, trim: true },
    logo: { type: String, trim: true },
    address: { type: String, trim: true },
    stampImage: { type: String, default: '', select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Company = mongoose.model('Company', companySchema);
