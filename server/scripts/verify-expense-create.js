/**
 * Creates dummy expenses covering expense nature + payment modes and verifies results.
 * Run: node scripts/verify-expense-create.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDatabase } = await import('../src/config/database.js');
const { User, Company, Location, BankAccount, Card } = await import('../src/models/index.js');
const { createExpense } = await import('../src/services/expense.service.js');
const { MONEY_EPSILON } = await import('../src/constants/paymentStatus.js');
const { calculateGST, calculateGrossAmount } = await import('../src/utils/gstCalculator.js');

const almostEqual = (a, b) => Math.abs(Number(a) - Number(b)) < Math.max(MONEY_EPSILON, 0.02);

const buildBase = ({ company, location, label }) => {
  const now = new Date();
  return {
    month: now.toLocaleString('en-US', { month: 'long' }),
    coNames: `Dummy Vendor — ${label}`,
    invoiceDate: now.toISOString(),
    dueDate: now.toISOString(),
    location: location || undefined,
    company,
    invoiceNo: `DUMMY-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    headOfExpense: 'Subscription',
    particulars: `Verification dummy: ${label}`,
    notes: 'Created by verify-expense-create.js',
    frequency: 'One-time',
    gstPercent: 18,
    useIGST: false,
    tds: 0,
    hasBillOrReceipt: true,
    isDraft: false,
  };
};

const scenarios = [
  {
    key: 'fixed-unpaid-bank',
    label: 'Fixed / Unpaid / Bank MER',
    expenseNature: 'Fixed',
    expenseType: 'Revenue',
    merType: 'Bank',
    netAmount: 10000,
    paymentMode: 'none',
  },
  {
    key: 'variable-full-cash',
    label: 'Variable / Pay Full / Cash',
    expenseNature: 'Variable',
    expenseType: 'Revenue',
    merType: 'Cash',
    netAmount: 5000,
    paymentMode: 'full',
    paymentMethod: 'Cash',
  },
  {
    key: 'fixed-partial-neft',
    label: 'Fixed / Pay Other / NEFT',
    expenseNature: 'Fixed',
    expenseType: 'Capital',
    merType: 'Bank',
    netAmount: 20000,
    paymentMode: 'partial',
    paymentMethod: 'NEFT',
    // partial ~40% of expected gross (20000 + 18% = 23600) => 9440
    partialFraction: 0.4,
  },
  {
    key: 'variable-full-upi',
    label: 'Variable / Pay Full / UPI',
    expenseNature: 'Variable',
    expenseType: 'Revenue',
    merType: 'Bank',
    netAmount: 2500,
    paymentMode: 'full',
    paymentMethod: 'UPI',
  },
  {
    key: 'fixed-full-card',
    label: 'Fixed / Pay Full / Card',
    expenseNature: 'Fixed',
    expenseType: 'Revenue',
    merType: 'Bank',
    netAmount: 7500,
    paymentMode: 'full',
    paymentMethod: 'Card',
  },
  {
    key: 'variable-partial-imps',
    label: 'Variable / Pay Other / IMPS',
    expenseNature: 'Variable',
    expenseType: 'Revenue',
    merType: 'Bank',
    netAmount: 12000,
    paymentMode: 'partial',
    paymentMethod: 'IMPS',
    partialFraction: 0.25,
  },
];

const expectedGross = (net, gstPercent = 18, tds = 0) => {
  const gst = calculateGST(net, gstPercent, false);
  return calculateGrossAmount(net, gst.totalGST, tds);
};

const run = async () => {
  await connectDatabase();

  const user = await User.findOne({ role: { $in: ['admin', 'superadmin'] } });
  if (!user) throw new Error('No admin/superadmin user found');

  const company = await Company.findOne({ isActive: { $ne: false } }).lean();
  if (!company) throw new Error('No company found');

  const locationDoc = await Location.findOne({
    company: company._id,
    isActive: { $ne: false },
  }).lean();
  const location = locationDoc?.label || undefined;

  const bank = await BankAccount.findOne({ isActive: { $ne: false } }).lean();
  const card = await Card.findOne({ isActive: { $ne: false } }).lean();
  const bankLabel = bank ? `${bank.bankName} - ${bank.last4}` : null;
  const cardLabel = card ? `${card.issuer} - ${card.last4}` : null;

  console.log(`User: ${user.email} (${user.role})`);
  console.log(`Company: ${company.name}`);
  console.log(`Bank: ${bankLabel || 'none'} | Card: ${cardLabel || 'none'}`);
  console.log('---');

  const results = [];

  for (const scenario of scenarios) {
    const gross = expectedGross(scenario.netAmount);
    const base = buildBase({
      company: company.name,
      location,
      label: scenario.label,
    });

    const payload = {
      ...base,
      expenseNature: scenario.expenseNature,
      expenseType: scenario.expenseType,
      merType: scenario.merType,
      netAmount: scenario.netAmount,
    };

    if (scenario.paymentMode === 'full' || scenario.paymentMode === 'partial') {
      payload.recordPaymentNow = true;
      payload.paymentDate = new Date().toISOString();
      payload.paymentMethod = scenario.paymentMethod;

      if (scenario.paymentMode === 'full') {
        payload.initialPaymentAmount = gross;
      } else {
        payload.initialPaymentAmount = Math.round(gross * scenario.partialFraction * 100) / 100;
      }

      if (['NEFT', 'RTGS', 'IMPS'].includes(scenario.paymentMethod)) {
        if (!bankLabel) throw new Error('Bank account required for NEFT/RTGS/IMPS test');
        payload.bankAccountNumber = bankLabel;
        payload.paymentRefNumber = `UTR-DUMMY-${scenario.key.toUpperCase()}`;
      } else if (scenario.paymentMethod === 'UPI') {
        payload.paymentRefNumber = `UPI-DUMMY-${Date.now()}`;
      } else if (scenario.paymentMethod === 'Card') {
        if (!cardLabel) throw new Error('Card required for Card payment test');
        payload.cardNumber = cardLabel;
        payload.paymentRefNumber = `AUTH-DUMMY-${Date.now()}`;
      } else if (scenario.paymentMethod === 'Cash') {
        payload.paymentRefNumber = `CASH-DUMMY-${Date.now()}`;
      }
    }

    const checks = [];
    try {
      const created = await createExpense(payload, user);
      const paid = Number(created.amountPaid || 0);
      const balance = Number(created.balanceDue || 0);
      const status = created.status;
      const expectedPaid =
        scenario.paymentMode === 'none'
          ? 0
          : scenario.paymentMode === 'full'
            ? gross
            : payload.initialPaymentAmount;
      const expectedBalance = Math.max(0, Math.round((gross - expectedPaid) * 100) / 100);
      const expectedStatus =
        expectedPaid <= 0
          ? 'Pending'
          : expectedBalance <= MONEY_EPSILON
            ? 'Paid'
            : 'PartiallyPaid';

      const assert = (ok, msg) => {
        checks.push({ ok, msg });
        if (!ok) console.log(`  FAIL: ${msg}`);
      };

      assert(created.expenseNature === scenario.expenseNature, `nature=${created.expenseNature}`);
      assert(created.expenseType === scenario.expenseType, `type=${created.expenseType}`);
      assert(created.merType === scenario.merType, `merType=${created.merType}`);
      assert(almostEqual(created.grossAmount, gross), `gross ${created.grossAmount} vs ${gross}`);
      assert(almostEqual(paid, expectedPaid), `paid ${paid} vs ${expectedPaid}`);
      assert(almostEqual(balance, expectedBalance), `balance ${balance} vs ${expectedBalance}`);
      assert(status === expectedStatus, `status ${status} vs ${expectedStatus}`);
      assert(created.frequency === 'One-time', `frequency=${created.frequency}`);

      if (scenario.paymentMode !== 'none') {
        assert(Array.isArray(created.payments) && created.payments.length >= 1, 'has payment row');
      } else {
        assert(!created.payments?.length, 'no payment rows when unpaid');
      }

      const ok = checks.every((c) => c.ok);
      results.push({
        key: scenario.key,
        label: scenario.label,
        ok,
        id: created._id,
        slNo: created.slNo,
        nature: created.expenseNature,
        status,
        gross: created.grossAmount,
        paid,
        balance,
      });
      console.log(
        `${ok ? 'PASS' : 'FAIL'} ${scenario.label} | ${created.slNo || created._id} | ${status} | paid=${paid} bal=${balance}`,
      );
    } catch (err) {
      results.push({ key: scenario.key, label: scenario.label, ok: false, error: err.message });
      console.log(`FAIL ${scenario.label} | ERROR: ${err.message}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log('---');
  console.log(`Result: ${passed}/${results.length} passed`);
  console.log(JSON.stringify(results, null, 2));

  await mongoose.disconnect();
  process.exit(passed === results.length ? 0 : 1);
};

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
