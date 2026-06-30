import { Expense } from '../models/Expense.js';
import { Company } from '../models/Company.js';
import { getFinancialYear } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import { calculateGST, calculateGrossAmount } from '../utils/gstCalculator.js';
import { buildExpenseQuery, buildPagination, buildSort } from '../utils/queryBuilder.js';
import { buildMerSerial, buildMerSerialBase } from '../utils/merSerial.js';
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

const resolveMerSerial = async ({ company, month, invoiceDate }) => {
  const companyCode = await resolveCompanyCode(company);
  const companyStr = asTrimmedString(company);
  const monthStr = asTrimmedString(month);
  const base = buildMerSerialBase({ companyCode, month: monthStr, invoiceDate });
  if (!base) {
    throw ApiError.badRequest('Company and month are required to generate expense serial number');
  }

  const financialYear = getFinancialYear(invoiceDate ? new Date(invoiceDate) : new Date());
  const count = await Expense.countDocuments({
    company: companyStr,
    month: monthStr,
    financialYear,
  });

  return buildMerSerial(base, count + 1);
};

export const applyCalculations = (data) => {
  const useIGST = data.useIGST === true || data.useIGST === 'true';
  const gst = calculateGST(data.netAmount, data.gstPercent, useIGST);
  const grossAmount = calculateGrossAmount(data.netAmount, gst.totalGST, data.tds);

  return {
    ...data,
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
  const payload = {
    ...calculated,
    location: locationLabel || calculated.location,
    status: cleaned.status || 'Pending',
    createdBy: user._id,
    updatedBy: user._id,
    isDraft,
    approvalStatus: APPROVAL_STATUS.PENDING,
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
    });
  } else if (payload.company && asTrimmedString(data.month)) {
    payload.slNo = await resolveMerSerial({
      company: payload.company,
      month: data.month,
      invoiceDate: data.invoiceDate,
    });
  }

  return Expense.create(payload);
};

export const updateExpense = async (id, data, user) => {
  const expense = await getExpenseById(id);
  assertCanEdit(expense, user);

  const wasDraft = expense.isDraft;
  const cleaned = stripWorkflowFields(data);
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

export const approveExpense = async (id, user) => {
  if (!canApproveExpense(user)) {
    throw ApiError.forbidden('Only admin can approve MER entries');
  }

  const expense = await getExpenseById(id);
  if (expense.isDraft) {
    throw ApiError.badRequest('Submit the entry before approval');
  }
  if (expense.approvalStatus !== APPROVAL_STATUS.PENDING) {
    throw ApiError.badRequest(`Cannot approve entry with status: ${expense.approvalStatus}`);
  }

  expense.approvalStatus = APPROVAL_STATUS.APPROVED;
  expense.approvedBy = user._id;
  expense.approvedAt = new Date();
  expense.updatedBy = user._id;
  await expense.save();
  return expense;
};

export const completeExpense = async (id, user) => {
  if (!canCompleteExpense(user)) {
    throw ApiError.forbidden('Only superadmin can complete MER entries');
  }

  const expense = await getExpenseById(id);
  if (expense.approvalStatus !== APPROVAL_STATUS.APPROVED) {
    throw ApiError.badRequest('Entry must be approved before completion');
  }

  expense.approvalStatus = APPROVAL_STATUS.COMPLETED;
  expense.completedBy = user._id;
  expense.completedAt = new Date();
  expense.updatedBy = user._id;
  await expense.save();
  return expense;
};

/** Backfill approvalStatus for existing records. */
export const migrateApprovalStatus = async () => {
  await Expense.updateMany(
    { approvalStatus: { $exists: false }, isDraft: true },
    { $set: { approvalStatus: APPROVAL_STATUS.PENDING } },
  );
  await Expense.updateMany(
    { approvalStatus: { $exists: false }, isDraft: { $ne: true } },
    { $set: { approvalStatus: APPROVAL_STATUS.COMPLETED } },
  );
};

export const getNextSlNo = async ({ company, month, invoiceDate }) => {
  const companyCode = await resolveCompanyCode(company);
  const companyStr = asTrimmedString(company);
  const monthStr = asTrimmedString(month);
  const base = buildMerSerialBase({ companyCode, month: monthStr, invoiceDate });
  if (!base) return null;

  const financialYear = getFinancialYear(invoiceDate ? new Date(invoiceDate) : new Date());
  const count = await Expense.countDocuments({
    company: companyStr,
    month: monthStr,
    financialYear,
  });

  return buildMerSerial(base, count + 1);
};
