/**
 * Clears all bill/expense data, then seeds coverage dummy data:
 * every bill + expense scenario, at least 30 entries per month.
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
  ExpensePayment,
  RecurringExpenseTemplate,
  DueBillNotification,
  Company,
  Location,
  BankAccount,
  Card,
  User,
} from '../models/index.js';
import { buildMerSerial, buildMerSerialBase, serialKindForStatus } from '../utils/merSerial.js';
import { calculateGST, calculateGrossAmount } from '../utils/gstCalculator.js';
import { toLocationLabel } from '../utils/locationFormat.js';
import { formatPaymentInstrumentDisplay } from '../utils/paymentInstrumentDisplay.js';
import { PAYMENT_METHODS } from '../constants/paymentMethods.js';
import {
  PAYMENT_STATUS,
  AMOUNT_TYPE,
  FIXED_FREQUENCIES,
  roundMoney,
} from '../constants/paymentStatus.js';

dotenv.config();

const TODAY = new Date(2026, 7, 13); // 13 Aug 2026
const START = new Date(2025, 3, 1); // Apr 2025 — start of FY 2025-26
const ENTRIES_PER_MONTH = 32;

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
  'AWS India',
];
const PARTICULARS = {
  Variable: [
    'One-time office supplies replenishment',
    'Courier charges for documents',
    'Laptop accessories and cables',
    'Housekeeping deep-clean',
    'Local travel and conveyance',
    'First-aid and medicine kit',
    'Printer toner and paper',
    'Fuel and parking for field visit',
    'Team lunch / F&B expense',
    'Puja / festival arrangement',
    'Miscellaneous office expense',
    'Capital equipment purchase',
  ],
  Fixed: [
    'Monthly rent / lease',
    'Internet and networking retainer',
    'SaaS subscription renewal',
    'Electricity / utility bill',
    'AMC / maintenance contract',
    'AWS usage invoice',
    'Insurance premium',
    'Annual software licence',
  ],
};

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

/**
 * One guaranteed scenario pack per month (32). Covers bills (unpaid / partial / hold)
 * and expenses (paid), every nature, method, GST, aging bucket, and approval path.
 */
const MONTHLY_SCENARIOS = [
  // —— Due bills (unpaid / open) ——
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'overdue', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'due_today', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'due_7', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'due_month', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'later', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'PartiallyPaid', due: 'overdue', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'PartiallyPaid', due: 'due_7', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'Hold', due: 'due_month', approval: 'Approved' },
  { role: 'bill', nature: 'Fixed', frequency: 'Monthly', amountType: 'Fixed', status: 'Pending', due: 'due_7', approval: 'Approved' },
  { role: 'bill', nature: 'Fixed', frequency: 'Monthly', amountType: 'Usage', status: 'Pending', due: 'overdue', approval: 'Approved' },
  { role: 'bill', nature: 'Fixed', frequency: 'Quarterly', amountType: 'Fixed', status: 'PartiallyPaid', due: 'due_month', approval: 'Approved' },
  { role: 'bill', nature: 'Fixed', frequency: 'Monthly', amountType: 'Fixed', status: 'Pending', due: 'due_today', approval: 'Approved', autoPay: true },
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'due_7', approval: 'Pending' },
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'due_month', approval: 'Completed' },
  { role: 'bill', nature: 'Variable', status: 'Cancelled', due: 'overdue', approval: 'Approved' },
  { role: 'bill', nature: 'Variable', status: 'Pending', due: 'later', approval: 'Pending', isDraft: true },

  // —— Expenses (fully paid) ——
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', paymentMethod: 'NEFT' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', paymentMethod: 'RTGS' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', paymentMethod: 'IMPS' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', paymentMethod: 'UPI' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', paymentMethod: 'Card' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', paymentMethod: 'Cash' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', expenseType: 'Capital' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', gstPercent: 0 },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', gstPercent: 18, useIGST: true },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', withTds: true },
  { role: 'expense', nature: 'Fixed', frequency: 'Monthly', amountType: 'Fixed', status: 'Paid', approval: 'Approved' },
  { role: 'expense', nature: 'Fixed', frequency: 'Quarterly', amountType: 'Fixed', status: 'Paid', approval: 'Approved' },
  { role: 'expense', nature: 'Fixed', frequency: 'Half-yearly', amountType: 'Fixed', status: 'Paid', approval: 'Approved' },
  { role: 'expense', nature: 'Fixed', frequency: 'Yearly', amountType: 'Usage', status: 'Paid', approval: 'Approved' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Completed' },
  { role: 'expense', nature: 'Variable', status: 'Paid', approval: 'Approved', expenseType: 'Revenue', gstPercent: 5 },
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

const monthName = (date) => date.toLocaleString('en-US', { month: 'long' });
const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};
const calendarDaysBetween = (from, to) =>
  Math.round((startOfDay(to) - startOfDay(from)) / 86400000);

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
      isCurrentMonth,
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
  const day = rand(1, Math.max(1, maxDay));
  return new Date(year, monthIndex, day, rand(9, 18), rand(0, 59), 0, 0);
};

const resolveDueDate = (invoiceDate, dueBucket) => {
  const today = startOfDay(TODAY);
  switch (dueBucket) {
    case 'overdue':
      return addDays(today, -rand(2, 40));
    case 'due_today':
      return new Date(today);
    case 'due_7':
      return addDays(today, rand(1, 7));
    case 'due_month': {
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const remaining = Math.max(8, calendarDaysBetween(today, monthEnd));
      return addDays(today, rand(8, remaining));
    }
    case 'later':
      return addDays(today, rand(32, 90));
    default:
      return addDays(invoiceDate, rand(7, 21));
  }
};

const buildPaymentFields = (scenario, bankDisplays, cardDisplays) => {
  const paymentMethod = scenario.paymentMethod || pick(PAYMENT_METHODS);
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
  } else if (paymentMethod === 'Cash') {
    fields.paymentRefNumber = `CASH${rand(1000, 9999)}`;
  }

  return fields;
};

const buildAmounts = (scenario) => {
  const netAmount = rand(800, 95000);
  const gstPercent = scenario.gstPercent ?? pick(GST_RATES);
  const useIGST = Boolean(scenario.useIGST) || (gstPercent > 0 && Math.random() < 0.2);
  const gst = calculateGST(netAmount, gstPercent, useIGST);
  const tds = scenario.withTds
    ? rand(100, Math.min(5000, Math.floor(netAmount * 0.1)))
    : 0;
  const grossAmount = calculateGrossAmount(netAmount, gst.totalGST, tds);
  return { netAmount, gstPercent, useIGST, gst, tds, grossAmount };
};

const buildExpenseDoc = ({
  company,
  locationLabel,
  invoiceDate,
  scenario,
  seqCounters,
  bankDisplays,
  cardDisplays,
  createdBy,
  templateId,
}) => {
  const month = monthName(invoiceDate);
  const payment = buildPaymentFields(scenario, bankDisplays, cardDisplays);
  const base = buildMerSerialBase({
    companyCode: company.code,
    month,
    invoiceDate,
    merType: payment.merType,
    kind: serialKindForStatus(scenario.status || PAYMENT_STATUS.PENDING),
  });
  const next = (seqCounters.get(base) || 0) + 1;
  seqCounters.set(base, next);

  const { netAmount, gstPercent, useIGST, gst, tds, grossAmount } = buildAmounts(scenario);
  const financialYear = getFinancialYear(invoiceDate);
  const quarter = `Q${Math.floor(invoiceDate.getMonth() / 3) + 1}`;
  const nature = scenario.nature || 'Variable';
  const frequency = nature === 'Fixed'
    ? (FIXED_FREQUENCIES.includes(scenario.frequency) ? scenario.frequency : 'Monthly')
    : 'One-time';
  const amountType = nature === 'Fixed'
    ? (scenario.amountType || AMOUNT_TYPE.FIXED)
    : AMOUNT_TYPE.FIXED;
  const status = scenario.status || PAYMENT_STATUS.PENDING;
  const isDraft = Boolean(scenario.isDraft);
  const dueDate = resolveDueDate(invoiceDate, scenario.due);
  const expenseType = scenario.expenseType || (nature === 'Fixed' ? 'Revenue' : pick(['Revenue', 'Revenue', 'Revenue', 'Capital']));
  const headOfExpense = EXPENSE_HEADS[scenario.headIndex % EXPENSE_HEADS.length];
  const vendor = CO_NAMES[scenario.headIndex % CO_NAMES.length];

  let amountPaid = 0;
  let balanceDue = roundMoney(grossAmount);
  let paymentDate;
  let clearedAt;
  let daysToClear;
  let payAmount = 0;

  if (status === PAYMENT_STATUS.PAID) {
    amountPaid = roundMoney(grossAmount);
    balanceDue = 0;
    paymentDate = addDays(invoiceDate, rand(0, 12));
    if (paymentDate > TODAY) paymentDate = new Date(TODAY);
    clearedAt = paymentDate;
    daysToClear = calendarDaysBetween(dueDate, clearedAt);
    payAmount = amountPaid;
  } else if (status === PAYMENT_STATUS.PARTIALLY_PAID) {
    payAmount = roundMoney(grossAmount * (rand(35, 70) / 100));
    amountPaid = payAmount;
    balanceDue = roundMoney(Math.max(0.01, grossAmount - amountPaid));
    paymentDate = addDays(invoiceDate, rand(0, 8));
    if (paymentDate > TODAY) paymentDate = new Date(TODAY);
  } else if (status === PAYMENT_STATUS.CANCELLED) {
    amountPaid = 0;
    balanceDue = roundMoney(grossAmount);
  }

  const autoPay = Boolean(scenario.autoPay);
  const id = new mongoose.Types.ObjectId();

  const doc = {
    _id: id,
    slNo: buildMerSerial(base, next),
    month,
    coNames: vendor,
    invoiceDate,
    dueDate,
    location: locationLabel,
    company: company.name,
    invoiceNo: `INV/${company.code}/${invoiceDate.getFullYear()}/${String(rand(1, 9999)).padStart(4, '0')}`,
    headOfExpense,
    particulars: pick(PARTICULARS[nature] || PARTICULARS.Variable),
    notes: `${scenario.role} · ${status} · ${nature}`,
    vendor,
    source: nature === 'Fixed' ? 'recurring' : 'manual',
    recurringTemplateId: templateId || null,
    expenseType,
    expenseNature: nature,
    amountType,
    frequency,
    netAmount,
    gstPercent,
    cgst: gst.cgst,
    sgst: gst.sgst,
    igst: gst.igst,
    totalGST: gst.totalGST,
    tds,
    grossAmount,
    amountPaid,
    balanceDue,
    clearedAt: clearedAt || undefined,
    daysToClear: daysToClear ?? undefined,
    paymentDate: paymentDate || undefined,
    paymentRefNumber: payment.paymentRefNumber,
    bankAccountNumber: payment.bankAccountNumber,
    cardNumber: payment.cardNumber,
    merType: payment.merType,
    paymentMethod: payment.paymentMethod,
    autoPay,
    autoPayCardNumber: autoPay ? pick(cardDisplays) : undefined,
    hasBillOrReceipt: status !== PAYMENT_STATUS.CANCELLED && !isDraft,
    useIGST,
    status,
    approvalStatus: isDraft ? 'Pending' : (scenario.approval || 'Approved'),
    financialYear,
    quarter,
    isDraft,
    createdBy: createdBy || undefined,
  };

  const paymentDoc = payAmount > 0
    ? {
      expenseId: id,
      amount: payAmount,
      paymentDate: paymentDate || TODAY,
      paymentMethod: payment.paymentMethod,
      paymentRefNumber: payment.paymentRefNumber,
      bankAccountNumber: payment.bankAccountNumber,
      cardNumber: payment.cardNumber,
      merType: payment.merType,
      notes: status === PAYMENT_STATUS.PAID ? 'Seed full settlement' : 'Seed partial payment',
      status: 'Active',
      createdBy: createdBy || undefined,
    }
    : null;

  return { doc, paymentDoc };
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

  console.log('Clearing bill / expense data...');
  const [deletedExpenses, deletedPayments, deletedTemplates, deletedNotifs] = await Promise.all([
    Expense.deleteMany({}),
    ExpensePayment.deleteMany({}),
    RecurringExpenseTemplate.deleteMany({}),
    DueBillNotification.deleteMany({}),
  ]);
  console.log(`  Expenses: ${deletedExpenses.deletedCount}`);
  console.log(`  Payments: ${deletedPayments.deletedCount}`);
  console.log(`  Recurring templates: ${deletedTemplates.deletedCount}`);
  console.log(`  Due notifications: ${deletedNotifs.deletedCount}`);

  console.log('Clearing bank accounts & cards...');
  const [deletedBanks, deletedCards] = await Promise.all([
    BankAccount.deleteMany({}),
    Card.deleteMany({}),
  ]);
  console.log(`  Banks: ${deletedBanks.deletedCount}, Cards: ${deletedCards.deletedCount}`);

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
  const bankDisplays = banks.map((b) => formatPaymentInstrumentDisplay({
    companyCode: companies.find((c) => String(c._id) === String(b.company))?.code,
    bankName: b.bankName,
    last4: b.last4,
  }));
  const cardDisplays = cards.map((c) => formatPaymentInstrumentDisplay({
    companyCode: companies.find((co) => String(co._id) === String(c.company))?.code,
    issuer: c.issuer,
    last4: c.last4,
  }));
  console.log(`  Banks: ${bankDisplays.join(', ')}`);
  console.log(`  Cards: ${cardDisplays.join(', ')}`);

  const sampleCompany = companies[0];
  const sampleLocs = locationsByCompany.get(sampleCompany.name) || ['HQ'];
  const templates = await RecurringExpenseTemplate.insertMany([
    {
      name: 'Office rent',
      company: sampleCompany.name,
      location: sampleLocs[0],
      coNames: 'Office Mart Supplies',
      headOfExpense: 'Utility',
      particulars: 'Monthly rent / lease',
      vendor: 'Office Mart Supplies',
      expenseType: 'Revenue',
      expenseNature: 'Fixed',
      amountType: 'Fixed',
      netAmount: 45000,
      gstPercent: 18,
      frequency: 'Monthly',
      dueDayOfMonth: 5,
      startDate: START,
      nextDueDate: addDays(TODAY, 5),
      isActive: true,
      createdBy: adminUser?._id,
    },
    {
      name: 'AWS usage',
      company: sampleCompany.name,
      location: sampleLocs[0],
      coNames: 'AWS India',
      headOfExpense: 'Subscription',
      particulars: 'AWS usage invoice',
      vendor: 'AWS India',
      expenseType: 'Revenue',
      expenseNature: 'Fixed',
      amountType: 'Usage',
      netAmount: 12000,
      gstPercent: 18,
      frequency: 'Monthly',
      dueDayOfMonth: 10,
      startDate: START,
      nextDueDate: addDays(TODAY, 10),
      isActive: true,
      autoPay: true,
      autoPayCardNumber: cardDisplays[0],
      createdBy: adminUser?._id,
    },
    {
      name: 'Annual insurance',
      company: companies[1 % companies.length].name,
      location: (locationsByCompany.get(companies[1 % companies.length].name) || ['HQ'])[0],
      coNames: 'SecureNet Services',
      headOfExpense: 'Miscellaneous',
      particulars: 'Insurance premium',
      vendor: 'SecureNet Services',
      expenseType: 'Revenue',
      expenseNature: 'Fixed',
      amountType: 'Fixed',
      netAmount: 28000,
      gstPercent: 18,
      frequency: 'Yearly',
      dueDayOfMonth: 1,
      startDate: START,
      nextDueDate: new Date(TODAY.getFullYear() + 1, 3, 1),
      isActive: true,
      createdBy: adminUser?._id,
    },
  ]);
  console.log(`Created ${templates.length} recurring templates`);

  const windows = buildMonthWindows();
  if (MONTHLY_SCENARIOS.length < ENTRIES_PER_MONTH) {
    throw new Error(`Need at least ${ENTRIES_PER_MONTH} monthly scenarios`);
  }
  console.log(`\nSeeding ${ENTRIES_PER_MONTH} entries × ${windows.length} months (${companies.length} companies)...`);

  const seqCounters = new Map();
  const expenseBatch = [];
  const paymentBatch = [];
  const counts = {
    bill: 0,
    expense: 0,
    paid: 0,
    pending: 0,
    partial: 0,
    hold: 0,
    cancelled: 0,
    draft: 0,
    fixed: 0,
    variable: 0,
  };

  for (let w = 0; w < windows.length; w += 1) {
    const window = windows[w];
    for (let i = 0; i < ENTRIES_PER_MONTH; i += 1) {
      const scenario = {
        ...MONTHLY_SCENARIOS[i],
        headIndex: (w * ENTRIES_PER_MONTH + i),
      };
      const company = companies[(w + i) % companies.length];
      const locs = locationsByCompany.get(company.name) || ['HQ'];
      const invoiceDate = randomInvoiceDate(window.year, window.monthIndex, window.maxDay);
      const templateId = scenario.nature === 'Fixed' ? pick(templates)._id : null;
      const { doc, paymentDoc } = buildExpenseDoc({
        company,
        locationLabel: pick(locs),
        invoiceDate,
        scenario,
        seqCounters,
        bankDisplays,
        cardDisplays,
        createdBy: adminUser?._id,
        templateId,
      });

      expenseBatch.push(doc);
      if (paymentDoc) paymentBatch.push(paymentDoc);

      if (scenario.role === 'bill') counts.bill += 1;
      else counts.expense += 1;
      if (doc.isDraft) counts.draft += 1;
      if (doc.expenseNature === 'Fixed') counts.fixed += 1;
      else counts.variable += 1;
      if (doc.status === 'Paid') counts.paid += 1;
      else if (doc.status === 'Pending') counts.pending += 1;
      else if (doc.status === 'PartiallyPaid') counts.partial += 1;
      else if (doc.status === 'Hold') counts.hold += 1;
      else if (doc.status === 'Cancelled') counts.cancelled += 1;
    }
    process.stdout.write(`  ${window.month} ${window.year}: ${ENTRIES_PER_MONTH} entries\n`);
  }

  console.log('\nInserting expenses...');
  await Expense.insertMany(expenseBatch, { ordered: false });
  console.log(`  ${expenseBatch.length} expenses`);

  if (paymentBatch.length) {
    console.log('Inserting payments...');
    await ExpensePayment.insertMany(paymentBatch, { ordered: false });
    console.log(`  ${paymentBatch.length} payments`);
  }

  const total = expenseBatch.length;
  console.log(`\nDone. Created ${total} bills/expenses (${windows.length} months × ${ENTRIES_PER_MONTH}).`);
  console.log('Coverage:');
  console.log(`  Bills (open/cancelled/draft): ${counts.bill}`);
  console.log(`  Expenses (paid):              ${counts.expense}`);
  console.log(`  Paid / Pending / Partial / Hold / Cancelled: ${counts.paid} / ${counts.pending} / ${counts.partial} / ${counts.hold} / ${counts.cancelled}`);
  console.log(`  Fixed / Variable: ${counts.fixed} / ${counts.variable}`);
  console.log(`  Drafts: ${counts.draft}`);
  console.log(`  Heads covered: ${EXPENSE_HEADS.join(', ')}`);
  console.log(`  Methods covered: ${PAYMENT_METHODS.join(', ')}`);

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
