/**
 * Clears all expenses, seeds 5 bank accounts + 5 cards, then creates
 * expense entries for each company for calendar 2025 and 2026 YTD.
 *
 * Run: pnpm --filter server seed:expenses
 *   or: node src/seed/seedExpensesAndPaymentInstruments.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri, EXPENSE_HEADS, getFinancialYear } from '../config/index.js';
import { getConnectionOptions } from '../config/database.js';
import {
  Expense,
  Company,
  Location,
  BankAccount,
  Card,
  User,
} from '../models/index.js';
import { buildMerSerial, buildMerSerialBase } from '../utils/merSerial.js';
import { calculateGST, calculateGrossAmount } from '../utils/gstCalculator.js';
import { toLocationLabel } from '../utils/locationFormat.js';

dotenv.config();

const TODAY = new Date(2026, 6, 13); // 13 Jul 2026 (match workspace date)
const START = new Date(2025, 0, 1);

const PAYMENT_METHODS = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Card', 'Cash'];
const GST_RATES = [0, 5, 12, 18];
const CO_NAMES = [
  'Office Mart Supplies',
  'City Couriers Pvt Ltd',
  'TechZone IT',
  'Green Housekeeping',
  'PowerGrid Utilities',
  'Travel Ease Cabs',
  'MediCare Pharmacy',
  'Stationery Hub',
  'Fuel Point Station',
  'CloudSoft Subscriptions',
  'Fresh Bites Catering',
  'SecureNet Services',
  'Print & Pack Solutions',
  'Urban Logistics',
  'QuickFix Electricals',
];
const PARTICULARS = [
  'Monthly office supplies replenishment',
  'Courier charges for documents',
  'Laptop accessories and cables',
  'Housekeeping services',
  'Electricity / utility bill payment',
  'Local travel and conveyance',
  'First-aid and medicine kit',
  'Printer toner and paper',
  'Fuel and parking for field visit',
  'SaaS subscription renewal',
  'Team lunch / F&B expense',
  'Internet and networking',
  'Puja / festival arrangement',
  'Miscellaneous office expense',
  'Stationary for branch operations',
];

const BANK_SEEDS = [
  { bankName: 'ICICI', last4: '2404', accountName: 'Ops Current', label: 'Primary ops' },
  { bankName: 'HDFC', last4: '7812', accountName: 'Vendor Payments', label: 'Vendor payouts' },
  { bankName: 'SBI', last4: '3356', accountName: 'Salary Account', label: 'Salary' },
  { bankName: 'AXIS', last4: '9021', accountName: 'Travel Float', label: 'Travel' },
  { bankName: 'KOTAK', last4: '4488', accountName: 'Utility Account', label: 'Utilities' },
];

const CARD_SEEDS = [
  { issuer: 'ICICI', last4: '2404', cardType: 'Credit', label: 'Corporate credit' },
  { issuer: 'HDFC', last4: '1190', cardType: 'Credit', label: 'Travel card' },
  { issuer: 'SBI', last4: '6677', cardType: 'Debit', label: 'Branch debit' },
  { issuer: 'AXIS', last4: '5543', cardType: 'Credit', label: 'Procurement' },
  { issuer: 'AMEX', last4: '3001', cardType: 'Credit', label: 'Executive' },
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const chance = (pct) => Math.random() * 100 < pct;

const monthName = (date) => date.toLocaleString('en-US', { month: 'long' });

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

/** Calendar months from Jan 2025 through Jul 2026 (partial). */
const buildMonthWindows = () => {
  const windows = [];
  let y = START.getFullYear();
  let m = START.getMonth();

  while (y < TODAY.getFullYear() || (y === TODAY.getFullYear() && m <= TODAY.getMonth())) {
    const isCurrentMonth = y === TODAY.getFullYear() && m === TODAY.getMonth();
    const maxDay = isCurrentMonth ? TODAY.getDate() : daysInMonth(y, m);
    windows.push({
      year: y,
      monthIndex: m,
      month: monthName(new Date(y, m, 1)),
      maxDay,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return windows;
};

const randomInvoiceDate = (year, monthIndex, maxDay) => {
  const day = rand(1, maxDay);
  const hour = rand(9, 18);
  const minute = rand(0, 59);
  return new Date(year, monthIndex, day, hour, minute, 0, 0);
};

const buildPaymentFields = (bankDisplays, cardDisplays) => {
  const paymentMethod = pick(PAYMENT_METHODS);
  const merType = paymentMethod === 'Cash' ? 'Cash' : 'Bank';
  const fields = {
    merType,
    paymentMethod,
    bankAccountNumber: '',
    cardNumber: '',
    paymentRefNumber: '',
  };

  if (['NEFT', 'RTGS', 'IMPS'].includes(paymentMethod)) {
    fields.bankAccountNumber = pick(bankDisplays);
    fields.paymentRefNumber = `${paymentMethod}${rand(100000000000, 999999999999)}`;
  } else if (paymentMethod === 'Card') {
    fields.cardNumber = pick(cardDisplays);
    fields.paymentRefNumber = `AUTH${rand(100000, 999999)}`;
  } else if (paymentMethod === 'UPI') {
    fields.paymentRefNumber = `UPI${rand(1000000000, 9999999999)}`;
  } else if (chance(40)) {
    fields.paymentRefNumber = `CASH${rand(1000, 9999)}`;
  }

  return fields;
};

const buildExpenseDoc = ({
  company,
  locationLabel,
  invoiceDate,
  seqCounters,
  bankDisplays,
  cardDisplays,
  createdBy,
}) => {
  const month = monthName(invoiceDate);
  const payment = buildPaymentFields(bankDisplays, cardDisplays);
  const base = buildMerSerialBase({
    companyCode: company.code,
    month,
    invoiceDate,
    merType: payment.merType,
  });
  const next = (seqCounters.get(base) || 0) + 1;
  seqCounters.set(base, next);
  const slNo = buildMerSerial(base, next);

  const netAmount = rand(500, 85000);
  const gstPercent = pick(GST_RATES);
  const useIGST = chance(25);
  const gst = calculateGST(netAmount, gstPercent, useIGST);
  const tds = chance(20) ? rand(100, Math.min(5000, Math.floor(netAmount * 0.1))) : 0;
  const grossAmount = calculateGrossAmount(netAmount, gst.totalGST, tds);
  const financialYear = getFinancialYear(invoiceDate);
  const q = Math.floor(invoiceDate.getMonth() / 3) + 1;

  const paymentDate = new Date(invoiceDate);
  paymentDate.setDate(paymentDate.getDate() + rand(0, 5));
  if (paymentDate > TODAY) paymentDate.setTime(TODAY.getTime());

  return {
    slNo,
    month,
    coNames: pick(CO_NAMES),
    invoiceDate,
    location: locationLabel,
    company: company.name,
    invoiceNo: `INV/${company.code}/${invoiceDate.getFullYear()}/${String(rand(1, 9999)).padStart(4, '0')}`,
    headOfExpense: pick(EXPENSE_HEADS),
    particulars: pick(PARTICULARS),
    notes: '',
    vendor: pick(CO_NAMES),
    expenseType: chance(18) ? 'Capital' : 'Revenue',
    netAmount,
    gstPercent,
    cgst: gst.cgst,
    sgst: gst.sgst,
    igst: gst.igst,
    totalGST: gst.totalGST,
    tds,
    grossAmount,
    paymentDate,
    paymentRefNumber: payment.paymentRefNumber,
    bankAccountNumber: payment.bankAccountNumber,
    cardNumber: payment.cardNumber,
    merType: payment.merType,
    paymentMethod: payment.paymentMethod,
    hasBillOrReceipt: chance(80),
    useIGST,
    status: 'Paid',
    approvalStatus: chance(85) ? 'Approved' : chance(50) ? 'Completed' : 'Pending',
    financialYear,
    quarter: `Q${q}`,
    isDraft: false,
    createdBy: createdBy || undefined,
  };
};

const seed = async () => {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  await mongoose.connect(uri, getConnectionOptions(uri));
  console.log(`Connected to ${mongoose.connection.name}\n`);

  const companies = await Company.find({ isActive: { $ne: false } }).select('name code').lean();
  if (!companies.length) {
    throw new Error('No companies found. Run seed:companies first.');
  }

  const locations = await Location.find({ isActive: { $ne: false } })
    .populate('company', 'name')
    .select('label company')
    .lean();

  const locationsByCompany = new Map();
  for (const loc of locations) {
    const name = loc.company?.name;
    if (!name) continue;
    if (!locationsByCompany.has(name)) locationsByCompany.set(name, []);
    const label = toLocationLabel(loc.label);
    if (label) locationsByCompany.get(name).push(label);
  }

  const adminUser = await User.findOne({ role: { $in: ['superadmin', 'admin'] } })
    .select('_id')
    .lean();

  console.log('Clearing expenses...');
  const deletedExpenses = await Expense.deleteMany({});
  console.log(`  Deleted ${deletedExpenses.deletedCount} expense(s)`);

  console.log('Clearing bank accounts & cards...');
  const [deletedBanks, deletedCards] = await Promise.all([
    BankAccount.deleteMany({}),
    Card.deleteMany({}),
  ]);
  console.log(`  Deleted ${deletedBanks.deletedCount} bank account(s), ${deletedCards.deletedCount} card(s)`);

  console.log('Creating 5 bank accounts & 5 cards...');
  const bankDocs = BANK_SEEDS.map((seedItem, index) => {
    const company = companies[index % companies.length];
    return {
      ...seedItem,
      company: company._id,
      companyName: company.name,
      isActive: true,
    };
  });
  const cardDocs = CARD_SEEDS.map((seedItem, index) => {
    const company = companies[index % companies.length];
    return {
      ...seedItem,
      company: company._id,
      companyName: company.name,
      isActive: true,
    };
  });

  const [banks, cards] = await Promise.all([
    BankAccount.insertMany(bankDocs),
    Card.insertMany(cardDocs),
  ]);
  const bankDisplays = banks.map((b) => `${b.bankName} - ${b.last4}`);
  const cardDisplays = cards.map((c) => `${c.issuer} - ${c.last4}`);
  console.log(`  Banks: ${bankDisplays.join(', ')}`);
  console.log(`  Cards: ${cardDisplays.join(', ')}`);

  const windows = buildMonthWindows();
  console.log(`\nSeeding expenses for ${companies.length} companies × ${windows.length} months...`);

  const seqCounters = new Map();
  const batch = [];
  let total = 0;

  for (const company of companies) {
    const locs = locationsByCompany.get(company.name) || ['HQ'];
    let companyCount = 0;

    for (const window of windows) {
      const count = rand(10, 30);
      for (let i = 0; i < count; i += 1) {
        const invoiceDate = randomInvoiceDate(window.year, window.monthIndex, window.maxDay);
        batch.push(
          buildExpenseDoc({
            company,
            locationLabel: pick(locs),
            invoiceDate,
            seqCounters,
            bankDisplays,
            cardDisplays,
            createdBy: adminUser?._id,
          }),
        );
        companyCount += 1;
        total += 1;

        if (batch.length >= 500) {
          await Expense.insertMany(batch, { ordered: false });
          batch.length = 0;
          process.stdout.write(`  Inserted ${total}...\r`);
        }
      }
    }
    console.log(`  ${company.code || company.name}: ${companyCount} expenses`);
  }

  if (batch.length) {
    await Expense.insertMany(batch, { ordered: false });
  }

  console.log(`\nDone. Created ${total} expenses.`);
  console.log(`Serial bases used: ${seqCounters.size}`);
  await mongoose.disconnect();
};

seed().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
