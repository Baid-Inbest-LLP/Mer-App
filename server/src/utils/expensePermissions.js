import { ApiError } from './ApiError.js';
import { APPROVAL_STATUS, isAdminRole, isSuperAdmin } from '../constants/roles.js';

const creatorId = (expense) =>
  expense.createdBy?._id?.toString() || expense.createdBy?.toString();

export const canEditExpense = (expense, user) => {
  if (expense.approvalStatus !== APPROVAL_STATUS.PENDING) return false;
  if (isAdminRole(user.role)) return true;
  return creatorId(expense) === user._id.toString();
};

export const canDeleteExpense = (expense, user) => canEditExpense(expense, user);

export const canApproveExpense = (user) => isAdminRole(user.role);

export const canCompleteExpense = (user) => isSuperAdmin(user.role);

export const assertCanEdit = (expense, user) => {
  if (!canEditExpense(expense, user)) {
    if (expense.approvalStatus !== APPROVAL_STATUS.PENDING) {
      throw ApiError.forbidden('Only pending MER entries can be edited');
    }
    throw ApiError.forbidden('You can only edit MER entries you created');
  }
};

export const assertCanDelete = (expense, user) => {
  if (!canDeleteExpense(expense, user)) {
    throw ApiError.forbidden('You do not have permission to delete this entry');
  }
};

export const stripWorkflowFields = (data) => {
  const cleaned = { ...data };
  delete cleaned.approvalStatus;
  delete cleaned.approvedBy;
  delete cleaned.approvedAt;
  delete cleaned.completedBy;
  delete cleaned.completedAt;
  delete cleaned._id;
  delete cleaned.createdBy;
  delete cleaned.updatedBy;
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  delete cleaned.__v;
  delete cleaned.invoiceCopy;
  delete cleaned.financialYear;
  delete cleaned.quarter;
  delete cleaned.slNo;
  delete cleaned.status;
  // Keep purchaseOrderId / poNumber / source for PO-linked creates; strip on update below if needed
  return cleaned;
};
