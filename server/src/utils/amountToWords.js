const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim();
};

const threeDigits = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hPart = h ? `${ONES[h]} Hundred` : '';
  const rPart = twoDigits(r);
  if (hPart && rPart) return `${hPart} ${rPart}`;
  return `${hPart}${rPart}`.trim();
};

const intToWordsIndian = (n) => {
  if (n === 0) return 'Zero';
  let num = n;
  const parts = [];

  const crore = Math.floor(num / 10000000);
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  num %= 1000;

  if (num) parts.push(threeDigits(num));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

export const amountToWordsINR = (amount) => {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return '';
  const rupees = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - rupees) * 100);

  const rupeesWords = intToWordsIndian(rupees);
  const paiseWords = paise ? twoDigits(paise) : '';

  const result = `Rupees ${rupeesWords}${paise ? ` and ${paiseWords} Paise` : ''} Only`;
  return result.replace(/\s+/g, ' ').trim();
};
