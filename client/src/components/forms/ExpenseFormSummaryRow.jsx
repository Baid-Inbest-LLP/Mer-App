import { formatSummaryAmount } from './expenseFormShared';

export default function ExpenseFormSummaryRow({
  label,
  value,
  bold = false,
  large = false,
  decimals = 2,
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span
        className={`expense-form-summary-row-label ${bold ? 'expense-form-summary-row-label-bold font-bold text-gray-900' : 'text-gray-600'}`}
      >
        {label}
      </span>
      <span
        className={`expense-form-summary-row-value ${large ? 'text-xl' : ''} ${bold ? 'expense-form-summary-row-value-bold font-bold text-primary-800' : 'font-medium text-gray-900'}`}
      >
        {formatSummaryAmount(value, decimals)}
      </span>
    </div>
  );
}
