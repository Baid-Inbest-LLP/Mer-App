import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User, Vendor, Company, Location, ExpenseHead, Expense } from '../models/index.js';
import { EXPENSE_HEADS, getFinancialYear, normalizeMongoUri } from '../config/index.js';
import { getConnectionOptions } from '../config/database.js';
import { ensureCompanies } from './ensureCompanies.js';
import { buildLocationName } from '../utils/locationFormat.js';
import { COMPANIES_SEED } from './companies.data.js';
import { buildMerSerial, buildMerSerialBase } from '../utils/merSerial.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

const seed = async () => {
  await mongoose.connect(uri, getConnectionOptions(uri));
  console.log('Connected for seeding...');

  await Promise.all([
    User.deleteMany(),
    Vendor.deleteMany(),
    Company.deleteMany(),
    Location.deleteMany(),
    ExpenseHead.deleteMany(),
    Expense.deleteMany(),
  ]);

  const superadmin = await User.create({
    name: 'Super Admin',
    email: process.env.SUPERADMIN_EMAIL || 'superadmin@mer.com',
    password: process.env.SUPERADMIN_PASSWORD || 'super123',
    role: 'superadmin',
  });

  const admin = await User.create({
    name: 'Admin User',
    email: process.env.ADMIN_EMAIL || 'admin@mer.com',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    role: 'admin',
  });

  await User.create({
    name: 'Regular User',
    email: process.env.USER_EMAIL || 'user@mer.com',
    password: process.env.USER_PASSWORD || 'user123',
    role: 'user',
  });

  const vendors = ['ABC Supplies', 'Tech Solutions', 'Office Mart', 'Clean Pro', 'Fuel Station'];
  const companyEntries = COMPANIES_SEED.map((c) => ({ name: c.name, companyCode: c.companyCode }));
  const locations = COMPANIES_SEED.flatMap((c) =>
    c.locations.map((loc) => buildLocationName(loc.label)),
  );

  await Vendor.insertMany(vendors.map((name) => ({ name })));
  await ensureCompanies();
  await ExpenseHead.insertMany(EXPENSE_HEADS.map((name) => ({ name })));

  const sampleExpenses = [];
  const serialCounts = new Map();
  const months = ['January', 'February', 'March', 'April', 'May'];
  for (let i = 0; i < 25; i++) {
    const net = Math.round(Math.random() * 50000 + 1000);
    const gstPercent = [0, 5, 12, 18][Math.floor(Math.random() * 4)];
    const totalGST = (net * gstPercent) / 100;
    const tds = Math.round(net * 0.02);
    const gross = net + totalGST - tds;
    const invoiceDate = new Date(2025, i % 12, 15);
    const month = months[i % months.length];
    const location = locations[i % locations.length];
    const companyEntry = companyEntries[i % companyEntries.length];
    const fy = getFinancialYear(invoiceDate);
    const serialKey = `${companyEntry.companyCode}|${month}|${fy}`;
    const seq = (serialCounts.get(serialKey) || 0) + 1;
    serialCounts.set(serialKey, seq);
    const slNo = buildMerSerial(
      buildMerSerialBase({ companyCode: companyEntry.companyCode, month, invoiceDate }),
      seq,
    );

    const approvalStatus = ['Pending', 'Approved', 'Completed'][i % 3];
    const entry = {
      slNo,
      month,
      coNames: 'John Doe',
      invoiceDate,
      location,
      company: companyEntry.name,
      invoiceNo: `INV-${1000 + i}`,
      monthlyInvoiceNumber: `MINV-${2000 + i}`,
      headOfExpense: EXPENSE_HEADS[i % EXPENSE_HEADS.length],
      particulars: `Sample expense ${i + 1}`,
      vendor: vendors[i % vendors.length],
      expenseType: i % 3 === 0 ? 'Capital' : 'Revenue',
      netAmount: net,
      gstPercent,
      cgst: gstPercent > 0 ? totalGST / 2 : 0,
      sgst: gstPercent > 0 ? totalGST / 2 : 0,
      totalGST,
      tds,
      grossAmount: gross,
      paymentDate: new Date(),
      paymentMethod: i % 2 === 0 ? 'Bank' : 'Cash',
      bankAccountNumber: i % 2 === 0 ? 'XXXX1234' : '',
      status: ['Paid', 'Pending', 'Paid'][i % 3],
      approvalStatus,
      financialYear: getFinancialYear(invoiceDate),
      createdBy: admin._id,
      updatedBy: admin._id,
    };
    if (approvalStatus === 'Approved' || approvalStatus === 'Completed') {
      entry.approvedBy = superadmin._id;
      entry.approvedAt = new Date();
    }
    if (approvalStatus === 'Completed') {
      entry.completedBy = superadmin._id;
      entry.completedAt = new Date();
    }
    sampleExpenses.push(entry);
  }

  await Expense.insertMany(sampleExpenses);

  console.log('Seed completed!');
  console.log(`Superadmin: ${process.env.SUPERADMIN_EMAIL || 'superadmin@mer.com'} / ${process.env.SUPERADMIN_PASSWORD || 'super123'}`);
  console.log(`Admin:      ${process.env.ADMIN_EMAIL || 'admin@mer.com'} / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  console.log(`User:       ${process.env.USER_EMAIL || 'user@mer.com'} / ${process.env.USER_PASSWORD || 'user123'}`);
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
