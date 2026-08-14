import {
  formatAmountInWords,
  formatCurrency,
  formatDate,
  formatMerSerial,
  getPaymentStatusLabel,
} from './format';

const line = (label, value) => {
  if (value == null || value === '' || value === '—') return null;
  return `${label}: ${value}`;
};

export const buildBillShareMessage = (expense) => {
  if (!expense) return '';

  const serial = expense.isDraft ? 'Draft' : formatMerSerial(expense.slNo) || 'Bill';
  const status = getPaymentStatusLabel(expense.status);
  const gross = formatCurrency(expense.grossAmount);
  const paid = formatCurrency(expense.amountPaid);
  const balance = formatCurrency(expense.balanceDue);
  const payments = (expense.payments || []).filter((p) => p.status !== 'Voided');

  const details = [
    line('Company', expense.company),
    line('Payee', expense.coNames || expense.vendor),
    line('Head', expense.headOfExpense),
    line('Particulars', expense.particulars),
    line('Invoice no', expense.invoiceNo),
    line('Invoice date', expense.invoiceDate ? formatDate(expense.invoiceDate) : null),
    line('Due date', expense.dueDate ? formatDate(expense.dueDate) : null),
    line('Payment method', expense.paymentMethod || expense.merType),
  ].filter(Boolean);

  const amounts = [
    line('Net', formatCurrency(expense.netAmount)),
    Number(expense.igst) > 0 || expense.useIGST
      ? line('IGST', formatCurrency(expense.igst))
      : line('GST', formatCurrency(expense.totalGST)),
    Number(expense.tds) > 0 ? line('TDS', formatCurrency(expense.tds)) : null,
    `Gross: ${gross}`,
    `Paid: ${paid}`,
    `*Balance due: ${balance}*`,
  ].filter(Boolean);

  const paymentLines = payments.slice(0, 5).map((p) => {
    const ref = p.paymentRefNumber ? ` · ${p.paymentRefNumber}` : '';
    return `• ${formatDate(p.paymentDate)} — ${formatCurrency(p.amount)} (${p.paymentMethod}${ref})`;
  });

  const parts = [
    `*${serial}*`,
    `Status: *${status}*`,
    '',
    '*Details*',
    ...details,
    '',
    '*Amounts*',
    ...amounts,
    `_${formatAmountInWords(expense.grossAmount)}_`,
  ];

  if (paymentLines.length) {
    parts.push('', '*Payments*', ...paymentLines);
  }

  if (expense.status === 'Paid' && (expense.clearedAt || expense.paymentDate)) {
    parts.push('', `Paid on ${formatDate(expense.clearedAt || expense.paymentDate)}`);
  }

  return parts.join('\n');
};

export const openWhatsAppShare = ({ text }) => {
  const url = `https://wa.me/?text=${encodeURIComponent(text || '')}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};
