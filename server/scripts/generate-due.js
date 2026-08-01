/**
 * Generates recurring expense entries that have come due (reminder mode).
 * Intended to run on a daily schedule (e.g. Render cron job).
 *
 * Run: node scripts/generate-due.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDatabase } = await import('../src/config/database.js');
const { User } = await import('../src/models/index.js');
const { generateAllDue } = await import('../src/services/recurring.service.js');

const run = async () => {
  await connectDatabase();

  // Recurring entries need a createdBy; attribute them to an admin/superadmin.
  const systemUser = await User.findOne({ role: { $in: ['superadmin', 'admin'] } })
    .sort({ createdAt: 1 })
    .lean();
  if (!systemUser) {
    throw new Error('No admin/superadmin user found to attribute generated entries');
  }

  const result = await generateAllDue(systemUser, { asOf: new Date() });
  console.log(
    `[generate-due] processed=${result.processed} created=${result.created} skipped=${result.skipped}`,
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[generate-due] failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
