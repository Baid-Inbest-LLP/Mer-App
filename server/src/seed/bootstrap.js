import { User } from '../models/User.js';
import { ensureCompanies } from './ensureCompanies.js';

const DEFAULT_SUPERADMIN = {
  name: 'Super Admin',
  email: process.env.SUPERADMIN_EMAIL || 'superadmin@mer.com',
  password: process.env.SUPERADMIN_PASSWORD || 'super123',
  role: 'superadmin',
};

const DEFAULT_ADMIN = {
  name: 'Admin User',
  email: process.env.ADMIN_EMAIL || 'admin@mer.com',
  password: process.env.ADMIN_PASSWORD || 'admin123',
  role: 'admin',
};

const DEFAULT_USER = {
  name: 'Regular User',
  email: process.env.USER_EMAIL || 'user@mer.com',
  password: process.env.USER_PASSWORD || 'user123',
  role: 'user',
};

/**
 * Creates default login accounts when the database has no users.
 */
/** Ensures a superadmin exists (upgrades or creates when missing). */
export const ensureSuperAdminAccount = async () => {
  const existing = await User.findOne({ role: 'superadmin' });
  if (existing) return;

  const email = DEFAULT_SUPERADMIN.email;
  const byEmail = await User.findOne({ email });
  if (byEmail) {
    byEmail.role = 'superadmin';
    await byEmail.save({ validateBeforeSave: false });
    console.log(`Upgraded ${email} to superadmin`);
    return;
  }

  if ((await User.countDocuments()) === 0) return;

  await User.create(DEFAULT_SUPERADMIN);
  console.log(`Created superadmin: ${email} / ${DEFAULT_SUPERADMIN.password}`);
};

export const ensureDefaultUsers = async () => {
  const count = await User.countDocuments();
  if (count > 0) {
    await ensureSuperAdminAccount();
    return;
  }

  await User.create([DEFAULT_SUPERADMIN, DEFAULT_ADMIN, DEFAULT_USER]);

  console.log('\n--- Default accounts created (database was empty) ---');
  console.log(`  Superadmin: ${DEFAULT_SUPERADMIN.email} / ${DEFAULT_SUPERADMIN.password}`);
  console.log(`  Admin:      ${DEFAULT_ADMIN.email} / ${DEFAULT_ADMIN.password}`);
  console.log(`  User:       ${DEFAULT_USER.email} / ${DEFAULT_USER.password}`);
  console.log('--- Run `pnpm --filter server seed` for full sample data ---\n');
};

export const bootstrapCompanies = async () => {
  try {
    await ensureCompanies();
  } catch (err) {
    console.error('Company bootstrap failed:', err.message);
  }
};
