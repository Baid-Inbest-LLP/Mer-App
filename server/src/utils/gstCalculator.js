/**
 * Calculate GST components from net amount and GST percentage
 * Uses CGST+SGST for intra-state (default) or IGST for inter-state
 */
export const calculateGST = (netAmount, gstPercent, useIGST = false) => {
  const net = parseFloat(netAmount) || 0;
  const percent = parseFloat(gstPercent) || 0;
  const totalGST = (net * percent) / 100;

  if (useIGST) {
    return {
      cgst: 0,
      sgst: 0,
      igst: Math.round(totalGST * 100) / 100,
      totalGST: Math.round(totalGST * 100) / 100,
    };
  }

  const half = Math.round((totalGST / 2) * 100) / 100;
  return {
    cgst: half,
    sgst: half,
    igst: 0,
    totalGST: Math.round(totalGST * 100) / 100,
  };
};

export const calculateGrossAmount = (netAmount, totalGST, tds) => {
  const net = parseFloat(netAmount) || 0;
  const gst = parseFloat(totalGST) || 0;
  const tdsAmount = parseFloat(tds) || 0;
  return Math.round((net + gst - tdsAmount) * 100) / 100;
};
