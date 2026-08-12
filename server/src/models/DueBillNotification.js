import mongoose from 'mongoose';

const REMINDER_TYPES = ['overdue_daily', 'due_7', 'due_3', 'due_1'];

const dueBillNotificationSchema = new mongoose.Schema(
  {
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      required: true,
      index: true,
    },
    reminderType: {
      type: String,
      enum: REMINDER_TYPES,
      required: true,
    },
    /** YYYY-MM-DD (IST calendar day) — used to dedupe daily overdue sends. */
    sentDate: { type: String, required: true, index: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

dueBillNotificationSchema.index(
  { expense: 1, reminderType: 1, sentDate: 1 },
  { unique: true },
);

export const REMINDER_TYPE = Object.freeze({
  OVERDUE_DAILY: 'overdue_daily',
  DUE_7: 'due_7',
  DUE_3: 'due_3',
  DUE_1: 'due_1',
});

export const DueBillNotification = mongoose.model(
  'DueBillNotification',
  dueBillNotificationSchema,
);
