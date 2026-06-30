/** Drop payment-status and MER-type (bank/cash) keys before API calls. */
export function omitPaymentFilters(filters = {}) {
  const { status, merType, ...rest } = filters;
  return rest;
}
