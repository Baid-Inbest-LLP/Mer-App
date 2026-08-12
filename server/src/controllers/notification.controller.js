import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getDueNotifySettings,
  setDueNotifyRecipients,
  processDueBillReminders,
  sendRemindersToRecipient,
} from '../services/dueNotify.service.js';

export const getDueNotifyConfig = asyncHandler(async (_req, res) => {
  const data = await getDueNotifySettings();
  ApiResponse.success(res, data, 'Due notification settings');
});

export const updateDueNotifyConfig = asyncHandler(async (req, res) => {
  const recipients = await setDueNotifyRecipients(req.body?.recipients ?? req.body?.emails);
  ApiResponse.success(res, { recipients }, 'Reminder recipients updated');
});

export const sendDueNotifyNow = asyncHandler(async (req, res) => {
  const force = req.body?.force === true;
  const result = await processDueBillReminders({
    force,
    recipients: req.body?.recipients,
  });
  ApiResponse.success(
    res,
    result,
    result.skipped
      ? result.reason || 'No reminders due today'
      : `Sent ${result.sentCount} bill reminder email(s)`,
  );
});

export const sendDueNotifyToRecipient = asyncHandler(async (req, res) => {
  const result = await sendRemindersToRecipient(req.params.recipientId);
  ApiResponse.success(
    res,
    result,
    result.skipped
      ? result.reason || 'No reminders due today for this recipient'
      : `Sent ${result.sentCount} reminder email(s) to ${result.recipients?.[0]?.email || 'recipient'}`,
  );
});
