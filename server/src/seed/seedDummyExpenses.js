import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User, Vendor, ExpenseHead, Location, Expense } from '../models/index.js';
import { EXPENSE_HEADS, getFinancialYear, normalizeMongoUri } from '../config/index.js';
import { getConnectionOptions } from '../config/database.js';
import { ensureCompanies } from './ensureCompanies.js';
import { COMPANIES_SEED } from './companies.data.js';
import { buildLocationName } from '../utils/locationFormat.js';
import { buildMerSerial, buildMerSerialBase } from '../utils/merSerial.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

const VENDORS = ['ABC Supplies', 'Tech Solutions', 'Office Mart', 'Clean Pro', 'Fuel Station'];
const PEOPLE = ['John Doe', 'Priya Sharma', 'Amit Verma', 'Sara Khan', 'Rahul Das', 'Neha Gupta'];
const PAYMENT_METHODS = ['Bank', 'Cash', 'UPI', 'Debit/Credit Card'];
const GST_RATES = [0, 5, 12, 18];

/** Inclusive random integer. */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Builds the list of { year, monthIndex } pairs to seed.
 * - FY 2025-26: April 2025 → March 2026 (full year)
 * - FY 2026-27: April 2026 → current month (till date)
 */
const buildMonthBuckets = () => {
  const now = new Date();
  const buckets = [];

  // FY 2025-26 (Apr 2025 .. Mar 2026)
  for (let m = 3; m <= 11; m += 1) buckets.push({ year: 2025, monthIndex: m });
  for (let m = 0; m <= 2; m += 1) buckets.push({ year: 2026, monthIndex: m });

  // FY 2026-27 (Apr 2026 .. current month, till date)
  for (let m = 3; m <= now.getMonth(); m += 1) {
    if (now.getFullYear() >= 2026) buckets.push({ year: 2026, monthIndex: m });
  }

  return buckets;
};

const monthName = (monthIndex) =>
  new Date(2000, monthIndex, 1).toLocaleString('en-US', { month: 'long' });

const seedDummyExpenses = async () => {
  await mongoose.connect(uri, getConnectionOptions(uri));
  console.log('Connected for dummy expense seeding...');

  // Ensure master data exists (idempotent / additive).
  await ensureCompanies();

  if ((await Vendor.countDocuments()) === 0) {
    await Vendor.insertMany(VENDORS.map((name) => ({ name })));
  }
  if ((await ExpenseHead.countDocuments()) === 0) {
    await ExpenseHead.insertMany(EXPENSE_HEADS.map((name) => ({ name })));
  }

  // Resolve users (used for createdBy / approvedBy / completedBy).
  const superadmin =
    (await User.findOne({ role: 'superadmin' })) ||
    (await User.create({
      name: 'Super Admin',
      email: process.env.SUPERADMIN_EMAIL || 'superadmin@mer.com',
      password: process.env.SUPERADMIN_PASSWORD || 'super123',
      role: 'superadmin',
    }));
  const admin =
    (await User.findOne({ role: 'admin' })) ||
    (await User.create({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@mer.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin',
    }));

  // Company + branch combos drawn from the master data.
  const companyBranches = COMPANIES_SEED.flatMap((c) =>
    c.locations.map((loc) => ({
      company: c.name,
      companyCode: c.companyCode,
      location: buildLocationName(loc.label),
    })),
  );

  // Seed serial counters from existing expenses so we never collide on slNo.
  const serialCounts = new Map();
  const existing = await Expense.find({}, 'slNo company month invoiceDate').lean();
  const companyCodeByName = Object.fromEntries(
    COMPANIES_SEED.map((c) => [c.name, c.companyCode]),
  );
  for (const e of existing) {
    const base = buildMerSerialBase({
      companyCode: companyCodeByName[e.company],
      month: e.month,
      invoiceDate: e.invoiceDate,
    });
    if (!base) continue;
    const seq = parseInt(String(e.slNo || '').split('/').pop(), 10) || 0;
    serialCounts.set(base, Math.max(serialCounts.get(base) || 0, seq));
  }

  const buckets = buildMonthBuckets();
  const docs = [];
  let invoiceCounter = Date.now() % 100000;

  for (const { year, monthIndex } of buckets) {
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth();
    const maxDay = isCurrentMonth ? now.getDate() : new Date(year, monthIndex + 1, 0).getDate();
    const month = monthName(monthIndex);
    const entriesThisMonth = randInt(5, 10);

    for (let i = 0; i < entriesThisMonth; i += 1) {
      const day = randInt(1, Math.max(1, maxDay));
      const invoiceDate = new Date(year, monthIndex, day);
      const fy = getFinancialYear(invoiceDate);
      const quarter = `Q${Math.floor(monthIndex / 3) + 1}`;

      const { company, companyCode, location } = pick(companyBranches);

      const net = randInt(1500, 75000);
      const gstPercent = pick(GST_RATES);
      const totalGST = Math.round((net * gstPercent) / 100);
      const tds = Math.round(net * 0.02);
      const grossAmount = net + totalGST - tds;

      const base = buildMerSerialBase({ companyCode, month, invoiceDate });
      const seq = (serialCounts.get(base) || 0) + 1;
      serialCounts.set(base, seq);
      const slNo = buildMerSerial(base, seq);

      const paymentMethod = pick(PAYMENT_METHODS);

      // Weight heavily toward Completed so reports/dashboards populate.
      const approvalStatus = pick([
        'Completed',
        'Completed',
        'Completed',
        'Completed',
        'Approved',
        'Pending',
      ]);

      invoiceCounter += 1;

      const entry = {
        slNo,
        month,
        coNames: pick(PEOPLE),
        invoiceDate,
        location,
        company,
        invoiceNo: `INV-${invoiceCounter}`,
        monthlyInvoiceNumber: `MINV-${invoiceCounter}`,
        headOfExpense: pick(EXPENSE_HEADS),
        particulars: `${pick(EXPENSE_HEADS)} expense for ${month} ${year}`,
        vendor: pick(VENDORS),
        expenseType: Math.random() < 0.25 ? 'Capital' : 'Revenue',
        netAmount: net,
        gstPercent,
        cgst: gstPercent > 0 ? totalGST / 2 : 0,
        sgst: gstPercent > 0 ? totalGST / 2 : 0,
        igst: 0,
        totalGST,
        tds,
        grossAmount,
        paymentDate: invoiceDate,
        paymentMethod,
        merType: paymentMethod,
        paymentRefNumber: paymentMethod === 'Cash' ? '' : `REF-${invoiceCounter}`,
        bankAccountNumber: paymentMethod === 'Bank' ? 'XXXX1234' : '',
        status: approvalStatus === 'Pending' ? 'Pending' : 'Paid',
        approvalStatus,
        financialYear: fy,
        quarter,
        isDraft: false,
        createdBy: admin._id,
        updatedBy: admin._id,
        createdAt: invoiceDate,
        updatedAt: invoiceDate,
      };

      if (approvalStatus === 'Approved' || approvalStatus === 'Completed') {
        entry.approvedBy = superadmin._id;
        entry.approvedAt = invoiceDate;
      }
      if (approvalStatus === 'Completed') {
        entry.completedBy = superadmin._id;
        entry.completedAt = invoiceDate;
      }

      docs.push(entry);
    }
  }

  await Expense.insertMany(docs);

  const byFy = docs.reduce((acc, d) => {
    acc[d.financialYear] = (acc[d.financialYear] || 0) + 1;
    return acc;
  }, {});

  console.log(`Inserted ${docs.length} dummy expense entries across ${buckets.length} months.`);
  console.log('Breakdown by financial year:', byFy);
  process.exit(0);
};

seedDummyExpenses().catch((err) => {
  console.error(err);
  process.exit(1);
});
