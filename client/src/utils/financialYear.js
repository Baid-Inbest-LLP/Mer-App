/** Indian FY label format, e.g. 2025-26 */
export const getPreviousFinancialYear = (fy) => {
  const [startYear] = fy.split('-').map(Number);
  if (!startYear) return '';
  const prevStart = startYear - 1;
  return `${prevStart}-${String(prevStart + 1).slice(-2)}`;
};

export const getRecentFinancialYearOptions = (currentFy, count = 2) => {
  if (!currentFy) return [];

  const options = [];
  let fy = currentFy;

  for (let i = 0; i < count; i += 1) {
    options.push({ value: fy, label: fy });
    fy = getPreviousFinancialYear(fy);
    if (!fy) break;
  }

  return options;
};
