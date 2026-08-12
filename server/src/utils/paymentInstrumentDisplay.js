/** Label format: COMPANYCODE - BANK - 1234 */
export const formatPaymentInstrumentDisplay = ({
  companyCode,
  bankName,
  issuer,
  last4,
} = {}) => {
  const parts = [
    String(companyCode || '').trim().toUpperCase(),
    String(bankName || issuer || '').trim().toUpperCase(),
    String(last4 || '').trim(),
  ].filter(Boolean);
  return parts.join(' - ');
};

export const companyCodeFromInstrument = (item, codeByName = {}) =>
  String(
    item?.company?.code
    || item?.companyCode
    || codeByName[item?.companyName]
    || '',
  ).trim();
