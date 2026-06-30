export const calculateGST = (netAmount, gstPercent, useIGST = false) => {
  const net = Number(netAmount) || 0;
  const percent = Number(gstPercent) || 0;
  const totalGST = (net * percent) / 100;

  if (useIGST) {
    return { cgst: 0, sgst: 0, igst: totalGST, totalGST };
  }
  return { cgst: totalGST / 2, sgst: totalGST / 2, igst: 0, totalGST };
};

export const calculateGross = (netAmount, totalGST, tds) => {
  const net = Number(netAmount) || 0;
  const gst = Number(totalGST) || 0;
  const tdsVal = Number(tds) || 0;
  return net + gst - tdsVal;
};
