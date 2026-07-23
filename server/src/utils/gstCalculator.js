/**
 * Round to nearest whole number (half-up):
 * 305.67 → 306, 298.33 → 298, 298.50 → 299
 */
export const roundGstAmount = (amount) => Math.round(Number(amount) || 0);

/** Keep paise precision for CGST/SGST display. */
const toPaise = (amount) => Math.round((Number(amount) || 0) * 100) / 100;

/**
 * Calculate GST components from net amount and GST percentage
 * Uses CGST+SGST for intra-state (default) or IGST for inter-state
 * CGST/SGST keep full decimal amounts; Total GST (and IGST) are rounded
 * to the nearest whole rupee.
 */
const splitGst = (rawGST, useIGST = false) => {
  const totalGST = roundGstAmount(rawGST);

  if (useIGST) {
    return {
      cgst: 0,
      sgst: 0,
      igst: totalGST,
      totalGST,
    };
  }

  const half = toPaise(rawGST / 2);
  return {
    cgst: half,
    sgst: half,
    igst: 0,
    totalGST,
  };
};

export const calculateGST = (netAmount, gstPercent, useIGST = false) => {
  const net = parseFloat(netAmount) || 0;
  const percent = parseFloat(gstPercent) || 0;
  return splitGst((net * percent) / 100, useIGST);
};

/** Build CGST/SGST/IGST from a known GST amount (e.g. imported from PO). */
export const calculateGSTFromAmount = (gstAmount, useIGST = false) =>
  splitGst(parseFloat(gstAmount) || 0, useIGST);

export const calculateGrossAmount = (netAmount, totalGST, tds) => {
  const net = parseFloat(netAmount) || 0;
  const gst = parseFloat(totalGST) || 0;
  const tdsAmount = parseFloat(tds) || 0;
  return Math.round((net + gst - tdsAmount) * 100) / 100;
};
