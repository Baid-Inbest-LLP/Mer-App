/**
 * Sends per-bill due reminders:
 * - Overdue: one email per bill every day until fully paid
 * - Upcoming: separate emails at 7, 3, and 1 days before due date
 *
 * Run: node scripts/notify-due.js
 * Optional: FORCE=1 node scripts/notify-due.js  (ignore send dedup for today)
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDatabase } = await import('../src/config/database.js');
await import('../src/models/index.js');
const { processDueBillReminders } = await import('../src/services/dueNotify.service.js');

const run = async () => {
  await connectDatabase();

  const force = process.env.FORCE === '1' || process.env.FORCE === 'true';
  const result = await processDueBillReminders({ force });

  if (result.skipped) {
    console.log(`[notify-due] skipped: ${result.reason}`);
  } else {
    console.log(
      `[notify-due] sent=${result.sentCount} skipped=${result.skippedCount} ` +
        `to=${result.recipients.join(', ')} date=${result.sentDate}`,
    );
    for (const row of result.sent) {
      console.log(`  - ${row.label}: ${row.serial} (${row.expenseId})`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[notify-due] failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
