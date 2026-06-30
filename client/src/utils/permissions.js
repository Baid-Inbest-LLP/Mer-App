import { APPROVAL_STATUS, isAdmin, isSuperAdmin } from '../constants/roles';

export const canEditExpense = (expense, user) => {
  if (!expense || !user) return false;
  if (expense.approvalStatus !== APPROVAL_STATUS.PENDING) return false;
  if (isAdmin(user.role)) return true;
  const creatorId = expense.createdBy?._id || expense.createdBy;
  return creatorId?.toString() === user._id?.toString();
};

export const canDeleteExpense = (expense, user) => canEditExpense(expense, user);

export const canApproveExpense = (expense, user) =>
  isAdmin(user?.role) && expense?.approvalStatus === APPROVAL_STATUS.PENDING && !expense?.isDraft;

export const canCompleteExpense = (expense, user) =>
  isSuperAdmin(user?.role) && expense?.approvalStatus === APPROVAL_STATUS.APPROVED;
