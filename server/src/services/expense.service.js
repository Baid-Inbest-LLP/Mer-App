import { Expense } from '../models/Expense.js';
import { Company } from '../models/Company.js';
import { ApiError } from '../utils/ApiError.js';
import { calculateGST, calculateGSTFromAmount, calculateGrossAmount } from '../utils/gstCalculator.js';
import { buildExpenseQuery, buildPagination, buildSort } from '../utils/queryBuilder.js';
import {
  buildMerSerial,
  buildMerSerialBase,
  buildMerSerialPattern,
} from '../utils/merSerial.js';
import { toLocationLabel } from '../utils/locationFormat.js';
import { APPROVAL_STATUS } from '../constants/roles.js';
import {
  assertCanDelete,
  assertCanEdit,
  canApproveExpense,
  canCompleteExpense,
  stripWorkflowFields,
} from '../utils/expensePermissions.js';

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

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('completedBy', 'name email')
      .lean(),
    Expense.countDocuments(filter),
  ]);

  return {
    expenses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getExpenseById = async (id) => {
  const expense = await Expense.findById(id)
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email')
    .populate('completedBy', 'name email');
  if (!expense) throw ApiError.notFound('Expense not found');
  return expense;
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

  const payload = {
    ...calculated,
    location: locationLabel || calculated.location,
    status: cleaned.status || 'Pending',
    createdBy: user._id,
    updatedBy: user._id,
    isDraft,
    approvalStatus: APPROVAL_STATUS.PENDING,
    purchaseOrderId,
    poNumber,
    source,
  };

  if (isDraft) {
    payload.invoiceDate = payload.invoiceDate || new Date();
    payload.month = asTrimmedString(payload.month)
      || new Date(payload.invoiceDate).toLocaleString('en-US', { month: 'long' });
    payload.coNames = asTrimmedString(payload.coNames) || 'Draft';
    payload.headOfExpense = asTrimmedString(payload.headOfExpense) || 'Draft';
    payload.expenseType = payload.expenseType || 'Revenue';
    payload.netAmount = payload.netAmount ?? 0;
  }

  if (cleaned.merType) payload.merType = cleaned.merType;
  if (cleaned.paymentMethod) payload.paymentMethod = cleaned.paymentMethod;

  if (!isDraft) {
    payload.slNo = await resolveMerSerial({
      company: payload.company,
      month: data.month,
      invoiceDate: data.invoiceDate,
      merType: payload.merType,
    });
  } else if (payload.company && asTrimmedString(data.month) && resolveMerType(payload.merType)) {
    payload.slNo = await resolveMerSerial({
      company: payload.company,
      month: data.month,
      invoiceDate: data.invoiceDate,
      merType: payload.merType,
    });
  }

  return Expense.create(payload);
};

export const updateExpense = async (id, data, user) => {
  const expense = await getExpenseById(id);
  assertCanEdit(expense, user);

  const wasDraft = expense.isDraft;
  const cleaned = stripWorkflowFields(data);
  // PO link is immutable after create
  delete cleaned.purchaseOrderId;
  delete cleaned.poNumber;
  delete cleaned.source;
  const calculated = applyCalculations({ ...expense.toObject(), ...cleaned });
  if (cleaned.location != null) {
    calculated.location = toLocationLabel(cleaned.location) || calculated.location;
  }

  const { status: _omitStatus, ...calculatedWithoutStatus } = calculated;
  Object.assign(expense, calculatedWithoutStatus, { updatedBy: user._id });

  if (data.isDraft !== undefined) {
    expense.isDraft = data.isDraft === true || data.isDraft === 'true';
  }

  if (wasDraft && !expense.isDraft) {
    expense.approvalStatus = APPROVAL_STATUS.PENDING;

    if (!asTrimmedString(expense.slNo)) {
      expense.slNo = await resolveMerSerial({
        company: expense.company,
        month: expense.month,
        invoiceDate: expense.invoiceDate,
        merType: expense.merType,
      });
    }
  }

  await expense.save();
  return expense;
};

export const deleteExpense = async (id, user) => {
  const expense = await getExpenseById(id);
  assertCanDelete(expense, user);
  await expense.deleteOne();
  return { id };
};

/** Admin: Pending → Completed */
export const approveExpense = async (id, user) => {
  if (!canApproveExpense(user)) {
    throw ApiError.forbidden('Only admin can complete MER entries');
  }

  const expense = await getExpenseById(id);
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
  return expense;
};

/** Superadmin: Completed → Approved */
export const completeExpense = async (id, user) => {
  if (!canCompleteExpense(user)) {
    throw ApiError.forbidden('Only superadmin can approve MER entries');
  }

  const expense = await getExpenseById(id);
  if (expense.approvalStatus !== APPROVAL_STATUS.COMPLETED) {
    throw ApiError.badRequest('Entry must be Completed before approval');
  }

  expense.approvalStatus = APPROVAL_STATUS.APPROVED;
  expense.completedBy = user._id;
  expense.completedAt = new Date();
  expense.updatedBy = user._id;
  await expense.save();
  return expense;
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
