import { Expense } from '../models/Expense.js';
import { ExpensePayment } from '../models/ExpensePayment.js';
import { Company } from '../models/Company.js';
import { ApiError } from '../utils/ApiError.js';
import { calculateGST, calculateGSTFromAmount, calculateGrossAmount } from '../utils/gstCalculator.js';
import { buildExpenseQuery, buildPagination, buildSort } from '../utils/queryBuilder.js';
import {
  buildMerSerial,
  buildMerSerialBase,
  buildMerSerialPattern,
  monthToDateInFy,
} from '../utils/merSerial.js';
import { getFinancialYear } from '../config/index.js';
import { toLocationLabel } from '../utils/locationFormat.js';
import { APPROVAL_STATUS } from '../constants/roles.js';
import {
  assertCanDelete,
  assertCanEdit,
  canApproveExpense,
  canCompleteExpense,
  stripWorkflowFields,
} from '../utils/expensePermissions.js';
import { EXPENSE_NATURES, AMOUNT_TYPES, AMOUNT_TYPE, RECURRING_FREQUENCIES, roundMoney } from '../constants/paymentStatus.js';
import { addPayment, recalculateExpensePaymentState } from './payment.service.js';

const asTrimmedString = (value) => {
  if (value == null || value === '') return '';
  return String(value).trim();
};

const resolveCompanyCode = async (companyName) => {
  const name = asTrimmedString(companyName);
  if (!name) {
    throw ApiError.badRequest('Company is required to generate expense serial number');
  }

  const company = await Company.findOne({ name }).select('code name').lean();
  if (!company?.code) {
    throw ApiError.badRequest(`Company code not found for: ${name}`);
  }

  return company.code;
};

const resolveMerType = (merType) => asTrimmedString(merType);

const countSerialSequence = async (base) => {
  const pattern = buildMerSerialPattern(base);
  if (!pattern) return 0;
  return Expense.countDocuments({ slNo: pattern });
};

const resolveMerSerial = async ({ company, month, invoiceDate, merType }) => {
  const type = resolveMerType(merType);
  const companyCode = await resolveCompanyCode(company);
  const monthStr = asTrimmedString(month);
  const base = buildMerSerialBase({
    companyCode,
    month: monthStr,
    invoiceDate,
    merType: type,
  });
  if (!base) {
    throw ApiError.badRequest(
      'Company, month, and MER type are required to generate expense serial number',
    );
  }

  const count = await countSerialSequence(base);
  return buildMerSerial(base, count + 1);
};

/** Exported for recurring template generation. */
export const resolveMerSerialForTemplate = resolveMerSerial;

export const applyCalculations = (data) => {
  const useIGST = data.useIGST === true || data.useIGST === 'true';
  const isPoExpense = Boolean(data.purchaseOrderId || data.source === 'purchase_order');
  const { gstAmount, ...rest } = data;

  const gst = isPoExpense
    ? calculateGSTFromAmount(gstAmount ?? rest.totalGST ?? 0, useIGST)
    : calculateGST(rest.netAmount, rest.gstPercent, useIGST);

  const net = parseFloat(rest.netAmount) || 0;
  const rawGstAmount = parseFloat(gstAmount ?? rest.totalGST) || 0;
  const gstPercent = isPoExpense
    ? (net > 0 ? parseFloat(((rawGstAmount / net) * 100).toFixed(2)) : 0)
    : rest.gstPercent;

  // PO expenses: persist/display gross from rounded net + rounded GST.
  const netForGross = isPoExpense ? Math.round(net) : net;
  const grossAmount = calculateGrossAmount(netForGross, gst.totalGST, rest.tds);

  return {
    ...rest,
    gstPercent,
    cgst: gst.cgst,
    sgst: gst.sgst,
    igst: gst.igst,
    totalGST: gst.totalGST,
    grossAmount,
  };
};

export const getExpenses = async (query) => {
  const filter = buildExpenseQuery(query);
  const { page, limit, skip } = buildPagination(query);
  const sort = buildSort(query);

  const [expenses, total, summaryRows] = await Promise.all([
    Expense.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('completedBy', 'name email')
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          grossAmount: { $sum: { $ifNull: ['$grossAmount', 0] } },
          amountPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
          balanceDue: { $sum: { $ifNull: ['$balanceDue', 0] } },
        },
      },
    ]),
  ]);

  const totals = summaryRows[0] || {
    count: 0,
    grossAmount: 0,
    amountPaid: 0,
    balanceDue: 0,
  };

  return {
    expenses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: { totals },
  };
};

export const getExpenseById = async (id) => {
  const expense = await Expense.findById(id)
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email')
    .populate('completedBy', 'name email');
  if (!expense) throw ApiError.notFound('Expense not found');

  const payments = await ExpensePayment.find({ expenseId: id })
    .sort({ paymentDate: -1, createdAt: -1 })
    .populate('createdBy', 'name email')
    .populate('voidedBy', 'name email')
    .lean();

  const obj = expense.toObject();
  obj.payments = payments;
  return obj;
};

export const createExpense = async (data, user) => {
  const cleaned = stripWorkflowFields(data);
  const calculated = applyCalculations(cleaned);
  const isDraft = cleaned.isDraft === true || cleaned.isDraft === 'true';
  const locationLabel = toLocationLabel(cleaned.location);
  const purchaseOrderId = asTrimmedString(cleaned.purchaseOrderId) || null;
  const poNumber = asTrimmedString(cleaned.poNumber) || null;
  const source = purchaseOrderId ? 'purchase_order' : (cleaned.source || 'manual');

  if (purchaseOrderId) {
    const existing = await Expense.findOne({ purchaseOrderId }).select('_id slNo').lean();
    if (existing) {
      throw ApiError.conflict(
        `This purchase order is already linked to MER entry ${existing.slNo || existing._id}`,
      );
    }
  }

  const expenseNature = EXPENSE_NATURES.includes(cleaned.expenseNature)
    ? cleaned.expenseNature
    : 'Variable';
  const isFixedNature = expenseNature === 'Fixed';
  const amountType = isFixedNature && AMOUNT_TYPES.includes(cleaned.amountType)
    ? cleaned.amountType
    : AMOUNT_TYPE.FIXED;
  const frequency = RECURRING_FREQUENCIES.includes(cleaned.frequency)
    ? cleaned.frequency
    : 'One-time';

  const grossAmount = roundMoney(calculated.grossAmount || 0);
  let dueDate;
  if (isFixedNature && cleaned.dueDate) {
    dueDate = new Date(cleaned.dueDate);
  }

  const payload = {
    ...calculated,
    location: locationLabel || calculated.location,
    expenseNature,
    amountType,
    frequency,
    amountPaid: 0,
    balanceDue: grossAmount,
    status: 'Pending',
    createdBy: user._id,
    updatedBy: user._id,
    isDraft,
    approvalStatus: APPROVAL_STATUS.PENDING,
    source,
  };

  if (dueDate) payload.dueDate = dueDate;

  if (isFixedNature) {
    if (!asTrimmedString(cleaned.invoiceNo)) delete payload.invoiceNo;
    if (!cleaned.invoiceDate) delete payload.invoiceDate;
  } else {
    delete payload.dueDate;
  }

  // Sparse unique index on purchaseOrderId rejects multiple explicit nulls — omit when unset.
  delete payload.purchaseOrderId;
  delete payload.poNumber;
  if (purchaseOrderId) payload.purchaseOrderId = purchaseOrderId;
  if (poNumber) payload.poNumber = poNumber;

  if (isDraft) {
    if (!isFixedNature) {
      payload.invoiceDate = payload.invoiceDate || new Date();
    } else {
      delete payload.invoiceDate;
    }
    payload.month = asTrimmedString(payload.month)
      || (payload.invoiceDate
        ? new Date(payload.invoiceDate).toLocaleString('en-US', { month: 'long' })
        : new Date().toLocaleString('en-US', { month: 'long' }));
    payload.coNames = asTrimmedString(payload.coNames) || 'Draft';
    payload.headOfExpense = asTrimmedString(payload.headOfExpense) || 'Draft';
    payload.expenseType = payload.expenseType || 'Revenue';
    payload.netAmount = payload.netAmount ?? 0;
  }

  if (cleaned.merType) payload.merType = cleaned.merType;
  if (cleaned.paymentMethod) payload.paymentMethod = cleaned.paymentMethod;

  const wantsAutoPay = isFixedNature
    && (cleaned.autoPay === true || cleaned.autoPay === 'true');
  if (wantsAutoPay) {
    payload.autoPay = true;
    payload.paymentMethod = 'Card';
    payload.autoPayCardNumber = asTrimmedString(cleaned.autoPayCardNumber || cleaned.cardNumber);
    if (payload.autoPayCardNumber) payload.cardNumber = payload.autoPayCardNumber;
  } else {
    payload.autoPay = false;
    payload.autoPayCardNumber = '';
  }

  const serialAnchorDate = data.invoiceDate
    || (isFixedNature ? (cleaned.recurringStartDate || cleaned.dueDate) : undefined)
    || (data.month ? monthToDateInFy(data.month, getFinancialYear(new Date())) : undefined);

  if (!isDraft) {
    payload.slNo = await resolveMerSerial({
      company: payload.company,
      month: data.month,
      invoiceDate: serialAnchorDate,
      merType: payload.merType,
    });
  } else if (payload.company && asTrimmedString(data.month) && resolveMerType(payload.merType)) {
    payload.slNo = await resolveMerSerial({
      company: payload.company,
      month: data.month,
      invoiceDate: serialAnchorDate,
      merType: payload.merType,
    });
  }

  const expense = await Expense.create(payload);

  // Optional initial payment when creating with a payment date (full or part).
  const recordPaymentNow = cleaned.recordPaymentNow === true
    || cleaned.recordPaymentNow === 'true'
    || Boolean(cleaned.paymentDate);
  const initialAmountRaw = cleaned.initialPaymentAmount ?? cleaned.paymentAmount;
  const hasExplicitAmount = initialAmountRaw !== undefined && initialAmountRaw !== null && initialAmountRaw !== '';

  if (!isDraft && recordPaymentNow && cleaned.paymentMethod) {
    const payAmount = hasExplicitAmount
      ? roundMoney(initialAmountRaw)
      : grossAmount;
    if (payAmount > 0) {
      try {
        await addPayment(expense._id, {
          amount: payAmount,
          paymentDate: cleaned.paymentDate || new Date(),
          paymentMethod: wantsAutoPay ? 'Card' : cleaned.paymentMethod,
          paymentRefNumber: wantsAutoPay
            ? (asTrimmedString(cleaned.paymentRefNumber) || 'AUTO-PAY')
            : cleaned.paymentRefNumber,
          bankAccountNumber: cleaned.bankAccountNumber,
          cardNumber: cleaned.cardNumber || payload.autoPayCardNumber,
          merType: payload.merType,
          notes: wantsAutoPay
            ? 'Auto-pay — full balance by credit card'
            : 'Initial payment on create',
        }, user);
      } catch (err) {
        await ExpensePayment.deleteMany({ expenseId: expense._id });
        await Expense.deleteOne({ _id: expense._id });
        throw err;
      }
    }
  }

  return getExpenseById(expense._id);
};

export const updateExpense = async (id, data, user) => {
  const existing = await Expense.findById(id);
  if (!existing) throw ApiError.notFound('Expense not found');
  assertCanEdit(existing, user);

  const wasDraft = existing.isDraft;
  const cleaned = stripWorkflowFields(data);
  // PO link is immutable after create
  delete cleaned.purchaseOrderId;
  delete cleaned.poNumber;
  delete cleaned.source;
  delete cleaned.recurringTemplateId;
  delete cleaned.amountPaid;
  delete cleaned.balanceDue;
  delete cleaned.recordPaymentNow;
  delete cleaned.initialPaymentAmount;
  delete cleaned.paymentAmount;

  const calculated = applyCalculations({ ...existing.toObject(), ...cleaned });
  if (cleaned.location != null) {
    calculated.location = toLocationLabel(cleaned.location) || calculated.location;
  }
  if (cleaned.dueDate) calculated.dueDate = new Date(cleaned.dueDate);
  if (cleaned.expenseNature && EXPENSE_NATURES.includes(cleaned.expenseNature)) {
    calculated.expenseNature = cleaned.expenseNature;
  }
  if (cleaned.amountType && AMOUNT_TYPES.includes(cleaned.amountType)) {
    calculated.amountType = cleaned.amountType;
  } else if (calculated.expenseNature !== 'Fixed') {
    calculated.amountType = AMOUNT_TYPE.FIXED;
  }
  if (cleaned.frequency && RECURRING_FREQUENCIES.includes(cleaned.frequency)) {
    calculated.frequency = cleaned.frequency;
  }

  const { status: _omitStatus, ...calculatedWithoutStatus } = calculated;
  Object.assign(existing, calculatedWithoutStatus, { updatedBy: user._id });

  if (existing.expenseNature === 'Fixed') {
    if (!asTrimmedString(cleaned.invoiceNo)) existing.invoiceNo = undefined;
    if (!cleaned.invoiceDate) existing.invoiceDate = undefined;
  } else {
    existing.dueDate = undefined;
  }

  if (data.isDraft !== undefined) {
    existing.isDraft = data.isDraft === true || data.isDraft === 'true';
  }

  if (wasDraft && !existing.isDraft) {
    existing.approvalStatus = APPROVAL_STATUS.PENDING;

    if (!asTrimmedString(existing.slNo)) {
      existing.slNo = await resolveMerSerial({
        company: existing.company,
        month: existing.month,
        invoiceDate: existing.invoiceDate,
        merType: existing.merType,
      });
    }
  }

  await existing.save();
  await recalculateExpensePaymentState(existing._id);
  return getExpenseById(existing._id);
};

export const deleteExpense = async (id, user) => {
  const expense = await Expense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found');
  assertCanDelete(expense, user);
  await ExpensePayment.deleteMany({ expenseId: id });
  await expense.deleteOne();
  return { id };
};

/** Admin: Pending → Completed */
export const approveExpense = async (id, user) => {
  if (!canApproveExpense(user)) {
    throw ApiError.forbidden('Only admin can complete MER entries');
  }

  const expense = await Expense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.isDraft) {
    throw ApiError.badRequest('Submit the entry before completion');
  }
  if (expense.approvalStatus !== APPROVAL_STATUS.PENDING) {
    throw ApiError.badRequest(`Cannot complete entry with status: ${expense.approvalStatus}`);
  }

  expense.approvalStatus = APPROVAL_STATUS.COMPLETED;
  expense.approvedBy = user._id;
  expense.approvedAt = new Date();
  expense.updatedBy = user._id;
  await expense.save();
  return getExpenseById(id);
};

/** Superadmin: Completed → Approved */
export const completeExpense = async (id, user) => {
  if (!canCompleteExpense(user)) {
    throw ApiError.forbidden('Only superadmin can approve MER entries');
  }

  const expense = await Expense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.approvalStatus !== APPROVAL_STATUS.COMPLETED) {
    throw ApiError.badRequest('Entry must be Completed before approval');
  }

  expense.approvalStatus = APPROVAL_STATUS.APPROVED;
  expense.completedBy = user._id;
  expense.completedAt = new Date();
  expense.updatedBy = user._id;
  await expense.save();
  return getExpenseById(id);
};

const APPROVAL_STATUS_V2_MIGRATION = 'approval-status-v2-pending-completed-approved';
const LEGACY_MID_TMP = '__legacy_mid__';

/**
 * Backfill missing approvalStatus and one-time remap:
 * Legacy Pending → Approved (admin) → Completed (superadmin)
 * becomes Pending → Completed (admin) → Approved (superadmin).
 *
 * Claims a migrations lock before swapping so concurrent startups cannot double-flip.
 */
export const migrateApprovalStatus = async () => {
  await Expense.updateMany(
    { approvalStatus: { $exists: false }, isDraft: true },
    { $set: { approvalStatus: APPROVAL_STATUS.PENDING } },
  );
  await Expense.updateMany(
    { approvalStatus: { $exists: false }, isDraft: { $ne: true } },
    { $set: { approvalStatus: APPROVAL_STATUS.APPROVED } },
  );

  const migrations = Expense.db.collection('migrations');
  const expenses = Expense.collection;

  // Repair any interrupted temp values from a prior attempt.
  const repaired = await expenses.updateMany(
    { approvalStatus: LEGACY_MID_TMP },
    { $set: { approvalStatus: 'Completed' } },
  );
  if (repaired.modifiedCount) {
    console.log(`Repaired ${repaired.modifiedCount} expense(s) stuck on temp approval status`);
  }

  const existing = await migrations.findOne({ _id: APPROVAL_STATUS_V2_MIGRATION });
  if (existing?.status === 'done') return;

  // Atomic claim via insert — fails if another process already inserted the lock.
  try {
    await migrations.insertOne({
      _id: APPROVAL_STATUS_V2_MIGRATION,
      status: 'running',
      claimedAt: new Date(),
    });
  } catch (err) {
    if (err?.code === 11000) return;
    throw err;
  }

  try {
    const mid = await expenses.updateMany(
      { approvalStatus: 'Approved' },
      { $set: { approvalStatus: LEGACY_MID_TMP } },
    );
    const finals = await expenses.updateMany(
      { approvalStatus: 'Completed' },
      { $set: { approvalStatus: 'Approved' } },
    );
    const mids = await expenses.updateMany(
      { approvalStatus: LEGACY_MID_TMP },
      { $set: { approvalStatus: 'Completed' } },
    );

    await migrations.updateOne(
      { _id: APPROVAL_STATUS_V2_MIGRATION },
      {
        $set: {
          status: 'done',
          appliedAt: new Date(),
          midRemapped: mid.modifiedCount || 0,
          finalRemapped: finals.modifiedCount || 0,
          midFinalized: mids.modifiedCount || 0,
        },
      },
    );

    const remapped = (mid.modifiedCount || 0) + (finals.modifiedCount || 0);
    console.log(
      `Remapped approvalStatus on ${remapped} expense(s) to Pending → Completed → Approved`,
    );
  } catch (err) {
    await migrations.deleteOne({ _id: APPROVAL_STATUS_V2_MIGRATION });
    throw err;
  }
};

export const getNextSlNo = async ({ company, month, invoiceDate, merType }) => {
  const type = resolveMerType(merType);
  const companyCode = await resolveCompanyCode(company);
  const monthStr = asTrimmedString(month);
  const base = buildMerSerialBase({
    companyCode,
    month: monthStr,
    invoiceDate,
    merType: type,
  });
  if (!base) return null;

  const count = await countSerialSequence(base);
  return buildMerSerial(base, count + 1);
};
