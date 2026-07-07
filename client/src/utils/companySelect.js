/**
 * Build select options for company dropdowns.
 * Value remains company name (API/filters); label shows company code.
 */
export const buildCompanySelectOptions = (companyNames = [], companyCodeByName = {}) =>
  (companyNames || []).map((name) => ({
    value: name,
    label: companyCodeByName[name] || name,
  }));

export const buildCompanySelectOptionsFromRecords = (companies = []) =>
  (companies || [])
    .filter((company) => company?.name)
    .map((company) => ({
      value: company.name,
      label: company.companyCode || company.code || company.name,
    }));
