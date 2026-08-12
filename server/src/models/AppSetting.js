import mongoose from 'mongoose';

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const AppSetting = mongoose.model('AppSetting', appSettingSchema);
