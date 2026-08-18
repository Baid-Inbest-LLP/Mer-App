import { config } from '../config/index.js';
import { randomUUID } from 'crypto';
import { AppSetting } from '../models/AppSetting.js';
import { Expense } from '../models/Expense.js';
import { DueBillNotification, REMINDER_TYPE } from '../models/DueBillNotification.js';
import { OPEN_PAYMENT_STATUSES } from '../constants/paymentStatus.js';
import { sendMail, isSmtpConfigured, isUsingTestTransport } from './mail.service.js';
import { ApiError } from '../utils/ApiError.js';

const SETTING_KEY = 'dueNotifyRecipients';
const LEGACY_SETTING_KEY = 'dueNotifyEmails';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UPCOMING_REMINDER_DAYS = Object.freeze({
  [REMINDER_TYPE.DUE_7]: 7,
  [REMINDER_TYPE.DUE_3]: 3,
  [REMINDER_TYPE.DUE_1]: 1,
});

const REMINDER_META = Object.freeze({
  [REMINDER_TYPE.OVERDUE_DAILY]: {
    label: 'Overdue',
    headline: 'Overdue bill — payment required',
    accent: '#b91c1c',
    badgeBg: '#fef2f2',
  },
  [REMINDER_TYPE.DUE_7]: {
    label: 'Due in 7 days',
    headline: 'Upcoming bill — first reminder',
    accent: '#1d4ed8',
    badgeBg: '#eff6ff',
  },
  [REMINDER_TYPE.DUE_3]: {
    label: 'Due in 3 days',
    headline: 'Upcoming bill — second reminder',
    accent: '#b45309',
    badgeBg: '#fffbeb',
  },
  [REMINDER_TYPE.DUE_1]: {
    label: 'Due in 1 day',
    headline: 'Upcoming bill — final reminder',
    accent: '#c2410c',
    badgeBg: '#ffedd5',
  },
});

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const formatSentDate = (d = new Date()) => {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysUntilDue = (dueDate, today = startOfDay()) => {
  if (!dueDate) return null;
  const due = startOfDay(new Date(dueDate));
  return Math.round((due - today) / (24 * 60 * 60 * 1000));
};

const formatInr = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatSerial = (slNo) => {
  if (!slNo) return 'Bill';
  return String(slNo).replace(/^MER\//, 'BILL/');
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const normalizeEmails = (raw) => {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const email of list) {
    const normalized = email.toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      throw ApiError.badRequest(`Invalid email address: ${email}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
};

const normalizeWhatsapp = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.replace(/[\s\-()]/g, '');
  if (compact.startsWith('+')) return compact;
  const digits = compact.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return digits;
};

const isValidWhatsapp = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

/** @returns {{ id: string, name: string, email: string, whatsapp: string }[]} */
export const normalizeRecipientUsers = (raw) => {
  if (raw == null) return [];

  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    return raw.map((email) => ({
      id: randomUUID(),
      name: String(email).split('@')[0] || 'Recipient',
      email: String(email).toLowerCase().trim(),
      whatsapp: '',
    }));
  }

  if (!Array.isArray(raw)) {
    throw ApiError.badRequest('Recipients must be an array');
  }

  const result = [];
  const seenEmails = new Set();

  for (const row of raw) {
    const name = String(row?.name || '').trim();
    const email = String(row?.email || '').trim().toLowerCase();
    const whatsapp = normalizeWhatsapp(row?.whatsapp);
    const id = String(row?.id || randomUUID());

    if (!name) throw ApiError.badRequest('Recipient name is required');
    if (!EMAIL_RE.test(email)) {
      throw ApiError.badRequest(`Invalid email address: ${row?.email || ''}`);
    }
    if (whatsapp && !isValidWhatsapp(whatsapp)) {
      throw ApiError.badRequest(`Invalid WhatsApp number for ${name}`);
    }
    if (seenEmails.has(email)) continue;

    seenEmails.add(email);
    result.push({ id, name, email, whatsapp });
  }

  return result;
};

const envRecipientUsers = () => {
  try {
    return normalizeRecipientUsers(normalizeEmails(config.notifyDueEmails));
  } catch {
    return [];
  }
};

const loadStoredRecipients = async () => {
  const setting =
    (await AppSetting.findOne({ key: SETTING_KEY }).lean()) ||
    (await AppSetting.findOne({ key: LEGACY_SETTING_KEY }).lean());
  if (setting?.value != null) {
    const fromDb = normalizeRecipientUsers(setting.value);
    if (fromDb.length) return fromDb;
  }
  const fromEnv = envRecipientUsers();
  if (fromEnv.length) return fromEnv;
  return [];
};

export const getDueNotifyRecipients = async () => {
  const users = await loadStoredRecipients();
  if (users.length) return users;
  return [
    {
      id: randomUUID(),
      name: 'Default',
      email: 'inbest.dev@gmail.com',
      whatsapp: '',
    },
  ];
};

export const getRecipientEmails = async (recipients) => {
  const users = recipients?.length
    ? normalizeRecipientUsers(recipients)
    : await getDueNotifyRecipients();
  return users.map((u) => u.email);
};

export const setDueNotifyRecipients = async (recipients) => {
  const normalized = normalizeRecipientUsers(recipients);
  if (!normalized.length) {
    throw ApiError.badRequest('At least one reminder recipient is required');
  }
  await AppSetting.findOneAndUpdate(
    { key: SETTING_KEY },
    { $set: { value: normalized } },
    { upsert: true, new: true },
  );
  return normalized;
};

export const getDueNotifySettings = async () => {
  const recipients = await getDueNotifyRecipients();
  return {
    recipients,
    smtpConfigured: isSmtpConfigured(),
    clientUrl: config.clientUrl,
    schedule: {
      overdue: 'One email per overdue bill every day until fully paid',
      upcoming: 'Separate emails at 7 days, 3 days, and 1 day before due date',
    },
  };
};

const resolveReminderForBill = (bill, today = startOfDay()) => {
  const days = daysUntilDue(bill.dueDate, today);
  if (days == null) return null;

  if (days < 0) return REMINDER_TYPE.OVERDUE_DAILY;

  if (days === UPCOMING_REMINDER_DAYS[REMINDER_TYPE.DUE_7]) return REMINDER_TYPE.DUE_7;
  if (days === UPCOMING_REMINDER_DAYS[REMINDER_TYPE.DUE_3]) return REMINDER_TYPE.DUE_3;
  if (days === UPCOMING_REMINDER_DAYS[REMINDER_TYPE.DUE_1]) return REMINDER_TYPE.DUE_1;

  return null;
};

const fetchOpenBillsWithDueDate = async () =>
  Expense.find({
    isDraft: { $ne: true },
    status: { $in: OPEN_PAYMENT_STATUSES },
    balanceDue: { $gt: 0 },
    dueDate: { $ne: null },
  })
    .sort({ dueDate: 1 })
    .lean();

const wasAlreadySent = async (expenseId, reminderType, sentDate) => {
  if (reminderType === REMINDER_TYPE.OVERDUE_DAILY) {
    const existing = await DueBillNotification.findOne({
      expense: expenseId,
      reminderType,
      sentDate,
    }).lean();
    return Boolean(existing);
  }

  const existing = await DueBillNotification.findOne({
    expense: expenseId,
    reminderType,
  }).lean();
  return Boolean(existing);
};

const recordSent = async (expenseId, reminderType, sentDate) => {
  const key =
    reminderType === REMINDER_TYPE.OVERDUE_DAILY
      ? { expense: expenseId, reminderType, sentDate }
      : { expense: expenseId, reminderType };

  await DueBillNotification.findOneAndUpdate(
    key,
    {
      $set: {
        expense: expenseId,
        reminderType,
        sentDate:
          reminderType === REMINDER_TYPE.OVERDUE_DAILY ? sentDate : 'once',
        sentAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
};

const buildBillEmail = (bill, reminderType, clientUrl) => {
  const meta = REMINDER_META[reminderType];
  const serial = formatSerial(bill.slNo);
  const dueLabel = formatDate(bill.dueDate);
  const balance = formatInr(bill.balanceDue);
  const billUrl = `${clientUrl}/entries/${bill._id}`;
  const dueBoardUrl = `${clientUrl}/bills?tab=due`;
  const days = daysUntilDue(bill.dueDate);
  const overdueDays = days < 0 ? Math.abs(days) : 0;

  const subject =
    reminderType === REMINDER_TYPE.OVERDUE_DAILY
      ? `MER — Overdue: ${serial} — ${balance} outstanding (${overdueDays} day${overdueDays === 1 ? '' : 's'})`
      : `MER — ${meta.label}: ${serial} — due ${dueLabel}`;

  const detailLine =
    reminderType === REMINDER_TYPE.OVERDUE_DAILY
      ? `This bill is <strong>${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue</strong>. Expected payment date was <strong>${escapeHtml(dueLabel)}</strong>.`
      : `Expected payment date: <strong>${escapeHtml(dueLabel)}</strong> (${escapeHtml(meta.label.toLowerCase())}).`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;">
      <div style="font-size:12px;letter-spacing:0.04em;opacity:0.75;text-transform:uppercase;">INBEST · MER</div>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;">${escapeHtml(meta.headline)}</h1>
    </div>
    <div style="padding:20px 24px;">
      <span style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;padding:4px 10px;border-radius:999px;background:${meta.badgeBg};color:${meta.accent};">
        ${escapeHtml(meta.label)}
      </span>
      <h2 style="margin:14px 0 6px;font-size:18px;color:#0f172a;">${escapeHtml(serial)}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.5;">${detailLine}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:8px 0;color:#64748b;">Company</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(bill.company || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Expense head</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(bill.headOfExpense || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Vendor</td><td style="padding:8px 0;text-align:right;color:#334155;">${escapeHtml(bill.vendor || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Due date</td><td style="padding:8px 0;text-align:right;font-weight:700;color:${meta.accent};">${escapeHtml(dueLabel)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Balance due</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:16px;color:#0f172a;">${escapeHtml(balance)}</td></tr>
      </table>
    </div>
    <div style="padding:16px 24px 24px;border-top:1px solid #e2e8f0;">
      <a href="${escapeHtml(billUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 16px;border-radius:8px;margin-right:8px;">
        View bill
      </a>
      <a href="${escapeHtml(dueBoardUrl)}" style="display:inline-block;color:#1d4ed8;text-decoration:none;font-weight:600;font-size:13px;padding:10px 0;">
        All due bills →
      </a>
    </div>
  </div>
</body>
</html>`;

  const text = [
    subject,
    '',
    meta.headline,
    `Bill: ${serial}`,
    `Company: ${bill.company || '—'}`,
    `Head: ${bill.headOfExpense || '—'}`,
    `Due date: ${dueLabel}`,
    `Balance due: ${balance}`,
    reminderType === REMINDER_TYPE.OVERDUE_DAILY
      ? `Overdue by ${overdueDays} day(s)`
      : meta.label,
    '',
    `View: ${billUrl}`,
  ].join('\n');

  return { subject, html, text };
};

/**
 * Evaluate all open bills and send individual reminder emails.
 * - Overdue: one email per bill per day until paid
 * - Upcoming: one email each at 7, 3, and 1 days before due date
 */
export const processDueBillReminders = async ({
  force = false,
  skipRecord = false,
  recipients,
} = {}) => {
  const recipientUsers = recipients?.length
    ? normalizeRecipientUsers(recipients)
    : await getDueNotifyRecipients();
  const to = recipientUsers.map((u) => u.email);

  const today = startOfDay();
  const sentDate = formatSentDate(today);
  const bills = await fetchOpenBillsWithDueDate();

  const sent = [];
  const skippedDetails = [];

  for (const bill of bills) {
    const reminderType = resolveReminderForBill(bill, today);
    if (!reminderType) continue;

    if (!force && (await wasAlreadySent(bill._id, reminderType, sentDate))) {
      skippedDetails.push({
        expenseId: String(bill._id),
        serial: formatSerial(bill.slNo),
        reminderType,
        reason: 'Already sent',
      });
      continue;
    }

    const email = buildBillEmail(bill, reminderType, config.clientUrl);
    const result = await sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (!skipRecord) {
      await recordSent(bill._id, reminderType, sentDate);
    }

    sent.push({
      expenseId: String(bill._id),
      serial: formatSerial(bill.slNo),
      reminderType,
      label: REMINDER_META[reminderType].label,
      balanceDue: bill.balanceDue,
      dueDate: bill.dueDate,
      messageId: result.messageId,
    });
  }

  const noRemindersDue = bills.every((bill) => !resolveReminderForBill(bill, today));

  return {
    skipped: sent.length === 0,
    reason:
      sent.length === 0
        ? noRemindersDue
          ? 'No reminders due today'
          : 'All due reminders were already sent today'
        : undefined,
    recipients: recipientUsers,
    sentCount: sent.length,
    skippedCount: skippedDetails.length,
    sent,
    skippedDetails,
    smtpConfigured: isSmtpConfigured(),
    testTransport: isUsingTestTransport(),
    sentDate,
  };
};

/** Manual test helper — runs today's reminder queue (respects dedup unless force). */
export const sendDueBillsDigest = async (options = {}) => processDueBillReminders(options);

/** Send today's due bill reminders to one recipient (manual; does not affect cron dedup). */
export const sendRemindersToRecipient = async (recipientId) => {
  const all = await getDueNotifyRecipients();
  const user = all.find((u) => String(u.id) === String(recipientId));
  if (!user) {
    throw ApiError.notFound('Recipient not found');
  }

  return processDueBillReminders({
    recipients: [user],
    force: true,
    skipRecord: true,
  });
};
