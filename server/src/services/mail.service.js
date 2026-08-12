import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';

let transporterPromise = null;
let usingTestAccount = false;

const hasSmtpConfig = () =>
  Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

export const isSmtpConfigured = () => hasSmtpConfig();

export const isUsingTestTransport = () => usingTestAccount;

const createTransporter = async () => {
  if (hasSmtpConfig()) {
    usingTestAccount = false;
    const { host, port, user, pass } = config.smtp;

    return nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass },
    });
  }

  // Dev fallback: Ethereal catcher so digests can be verified without SMTP secrets.
  if (config.env === 'development') {
    const testAccount = await nodemailer.createTestAccount();
    usingTestAccount = true;
    console.warn(
      `[mail] SMTP not configured — using Ethereal test account ${testAccount.user}`,
    );
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  throw ApiError.badRequest(
    'Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.',
  );
};

const getTransporter = async () => {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((err) => {
      transporterPromise = null;
      throw err;
    });
  }
  return transporterPromise;
};

/** Reset cached transport (e.g. after env change in tests). */
export const resetMailTransport = () => {
  transporterPromise = null;
  usingTestAccount = false;
};

/**
 * Send an email. Returns { messageId, accepted, previewUrl? }.
 */
export const sendMail = async ({ to, subject, html, text }) => {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) {
    throw ApiError.badRequest('At least one recipient email is required');
  }

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: recipients.join(', '),
    subject,
    html,
    text: text || undefined,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  if (previewUrl) {
    console.log(`[mail] preview: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    accepted: info.accepted || recipients,
    previewUrl,
    testTransport: usingTestAccount,
  };
};
