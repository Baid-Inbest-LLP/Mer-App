import { Expense } from '../models/Expense.js';
import { ExpensePayment } from '../models/ExpensePayment.js';
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
import { EXPENSE_NATURES, RECURRING_FREQUENCIES, roundMoney } from '../constants/paymentStatus.js';
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

/** Exported for recurring template generation. */
export const resolveMerSerialForTemplate = resolveMerSerial;

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

  const grossAmount = roundMoney(calculated.grossAmount || 0);
  const dueDate = cleaned.dueDate
    ? new Date(cleaned.dueDate)
    : (cleaned.invoiceDate ? new Date(cleaned.invoiceDate) : new Date());
  const expenseNature = EXPENSE_NATURES.includes(cleaned.expenseNature)
    ? cleaned.expenseNature
    : 'Variable';
  const frequency = RECURRING_FREQUENCIES.includes(cleaned.frequency)
    ? cleaned.frequency
    : 'One-time';

  const payload = {
    ...calculated,
    location: locationLabel || calculated.location,
    dueDate,
    expenseNature,
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

  // Sparse unique index on purchaseOrderId rejects multiple explicit nulls — omit when unset.
  delete payload.purchaseOrderId;
  delete payload.poNumber;
  if (purchaseOrderId) payload.purchaseOrderId = purchaseOrderId;
  if (poNumber) payload.poNumber = poNumber;

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
          paymentMethod: cleaned.paymentMethod,
          paymentRefNumber: cleaned.paymentRefNumber,
          bankAccountNumber: cleaned.bankAccountNumber,
          cardNumber: cleaned.cardNumber,
          merType: payload.merType,
          notes: 'Initial payment on create',
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
  if (cleaned.frequency && RECURRING_FREQUENCIES.includes(cleaned.frequency)) {
    calculated.frequency = cleaned.frequency;
  }

  const { status: _omitStatus, ...calculatedWithoutStatus } = calculated;
  Object.assign(existing, calculatedWithoutStatus, { updatedBy: user._id });

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

export const approveExpense = async (id, user) => {
  if (!canApproveExpense(user)) {
    throw ApiError.forbidden('Only admin can approve MER entries');
  }

  const expense = await Expense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found');
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
  return getExpenseById(id);
};

export const completeExpense = async (id, user) => {
  if (!canCompleteExpense(user)) {
    throw ApiError.forbidden('Only superadmin can complete MER entries');
  }

  const expense = await Expense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.approvalStatus !== APPROVAL_STATUS.COMPLETED) {
    throw ApiError.badRequest('Entry must be Completed before approval');
  }

  expense.approvalStatus = APPROVAL_STATUS.COMPLETED;
  expense.completedBy = user._id;
  expense.completedAt = new Date();
  expense.updatedBy = user._id;
  await expense.save();
  return getExpenseById(id);
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
