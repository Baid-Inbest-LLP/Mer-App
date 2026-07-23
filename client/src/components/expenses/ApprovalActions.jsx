import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { approveExpense, completeExpense } from '../../store/slices/expenseSlice';
import { canApproveExpense, canCompleteExpense } from '../../utils/permissions';

export default function ApprovalActions({ expense, onSuccess }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const showApprove = canApproveExpense(expense, user);
  const showComplete = canCompleteExpense(expense, user);

  if (!showApprove && !showComplete) return null;

  const handleApprove = async () => {
    const result = await dispatch(approveExpense(expense._id));
    if (approveExpense.fulfilled.match(result)) {
      notifications.show({ message: 'Expense entry marked as Completed', color: 'green' });
      onSuccess?.(result.payload);
    } else {
      notifications.show({ message: result.payload || 'Update failed', color: 'red' });
    }
  };

  const handleComplete = async () => {
    const result = await dispatch(completeExpense(expense._id));
    if (completeExpense.fulfilled.match(result)) {
      notifications.show({ message: 'Expense entry Approved', color: 'green' });
      onSuccess?.(result.payload);
    } else {
      notifications.show({ message: result.payload || 'Approval failed', color: 'red' });
    }
  };

  return (
    <>
      {showApprove && (
        <button type="button" onClick={handleApprove} className="btn-success">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Complete
        </button>
      )}
      {showComplete && (
        <button type="button" onClick={handleComplete} className="btn-success">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Approve
        </button>
      )}
    </>
  );
}
