/**
 * Builds MongoDB query from request query params for expenses
 */
export const buildExpenseQuery = (query) => {
  const filter = { isDraft: { $ne: true } };

  if (query.includeDrafts === 'true') {
    delete filter.isDraft;
  }

  if (query.draftsOnly === 'true') {
    filter.isDraft = true;
  }

  if (query.status) filter.status = query.status;
  if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
  if (query.expenseType) filter.expenseType = query.expenseType;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.headOfExpense) filter.headOfExpense = query.headOfExpense;
  if (query.financialYear) filter.financialYear = query.financialYear;
  if (query.month) filter.month = query.month;
  if (query.quarter) filter.quarter = query.quarter;
  if (query.location) filter.location = query.location;
  if (query.company) filter.company = query.company;
  if (query.vendor) filter.vendor = query.vendor;
  if (query.bankAccountNumber) filter.bankAccountNumber = query.bankAccountNumber;
  if (query.coNames) filter.coNames = new RegExp(query.coNames, 'i');

  if (query.merType === 'BANK') {
    filter.$and = [...(filter.$and || []), {
      $or: [
        { merType: 'Bank' },
        { merType: { $exists: false }, paymentMethod: 'Bank' },
      ],
    }];
  }
  if (query.merType === 'CASH') {
    filter.$and = [...(filter.$and || []), {
      $or: [
        { merType: 'Cash' },
        { merType: { $exists: false }, paymentMethod: 'Cash' },
      ],
    }];
  }
  if (query.merType === 'UPI') {
    filter.$and = [...(filter.$and || []), {
      $or: [
        { merType: 'UPI' },
        { merType: { $exists: false }, paymentMethod: 'UPI' },
      ],
    }];
  }
  if (query.merType === 'CARD') {
    filter.$and = [...(filter.$and || []), {
      $or: [
        { merType: 'Debit/Credit Card' },
        { merType: { $exists: false }, paymentMethod: 'Debit/Credit Card' },
      ],
    }];
  }

  if (query.paymentDateFrom || query.paymentDateTo) {
    filter.paymentDate = {};
    if (query.paymentDateFrom) filter.paymentDate.$gte = new Date(query.paymentDateFrom);
    if (query.paymentDateTo) filter.paymentDate.$lte = new Date(query.paymentDateTo);
  }

  if (query.invoiceDateFrom || query.invoiceDateTo) {
    filter.invoiceDate = {};
    if (query.invoiceDateFrom) filter.invoiceDate.$gte = new Date(query.invoiceDateFrom);
    if (query.invoiceDateTo) filter.invoiceDate.$lte = new Date(query.invoiceDateTo);
  }

  if (query.timeframe) {
    const now = new Date();
    let start;
    switch (query.timeframe) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
        break;
      }
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        break;
    }
    if (start) {
      filter.invoiceDate = { ...filter.invoiceDate, $gte: start };
    }
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search, 'i');
    filter.$or = [
      { invoiceNo: searchRegex },
      { coNames: searchRegex },
      { particulars: searchRegex },
      { company: searchRegex },
      { monthlyInvoiceNumber: searchRegex },
    ];
  }

  return filter;
};

export const buildPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const buildSort = (query, defaultSort = { invoiceDate: -1 }) => {
  if (!query.sortBy) return defaultSort;
  const order = query.sortOrder === 'asc' ? 1 : -1;
  return { [query.sortBy]: order };
};
