import { RecurringExpenseTemplate } from '../models/RecurringExpenseTemplate.js';
import { Expense } from '../models/Expense.js';
import { ApiError } from '../utils/ApiError.js';
import { applyCalculations, resolveMerSerialForTemplate } from './expense.service.js';
import { APPROVAL_STATUS } from '../constants/roles.js';
import { EXPENSE_NATURE, AMOUNT_TYPE, AMOUNT_TYPES, roundMoney } from '../constants/paymentStatus.js';

const asTrimmed = (value) => {
  if (value == null || value === '') return '';
  return String(value).trim();
};

const clampDueDay = (day) => Math.min(28, Math.max(1, parseInt(day, 10) || 1));

export const buildDueDateForMonth = (year, monthIndex, dueDayOfMonth) => {
  const day = clampDueDay(dueDayOfMonth);
  return new Date(year, monthIndex, day);
};

export const advanceNextDueDate = (fromDate, frequency, dueDayOfMonth) => {
  const base = new Date(fromDate);
  const day = clampDueDay(dueDayOfMonth);

  if (frequency === 'One-time') {
    return new Date(base);
  }
  if (frequency === 'Daily') {
    const next = new Date(base);
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (frequency === 'Weekly') {
    const next = new Date(base);
    next.setDate(next.getDate() + 7);
    return next;
  }

  let year = base.getFullYear();
  let month = base.getMonth();

  if (frequency === 'Quarterly') month += 3;
  else if (frequency === 'Half-yearly') month += 6;
  else if (frequency === 'Yearly') year += 1;
  else month += 1; // Monthly (default)

  return new Date(year, month, day);
};

export const listTemplates = async (query = {}) => {
  const filter = {};
  if (query.activeOnly !== 'false') filter.isActive = true;
  if (query.company) filter.company = query.company;
  if (query.expenseNature) filter.expenseNature = query.expenseNature;

  return RecurringExpenseTemplate.find(filter)
    .sort({ nextDueDate: 1, name: 1 })
    .populate('createdBy', 'name email')
    .lean();
};

export const getTemplateById = async (id) => {
  const template = await RecurringExpenseTemplate.findById(id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
  if (!template) throw ApiError.notFound('Recurring template not found');
  return template;
};

export const createTemplate = async (data, user) => {
  const dueDayOfMonth = clampDueDay(data.dueDayOfMonth);
  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const nextDueDate = data.nextDueDate
    ? new Date(data.nextDueDate)
    : buildDueDateForMonth(startDate.getFullYear(), startDate.getMonth(), dueDayOfMonth);

  return RecurringExpenseTemplate.create({
    name: asTrimmed(data.name),
    company: asTrimmed(data.company),
    location: asTrimmed(data.location),
    coNames: asTrimmed(data.coNames),
    headOfExpense: asTrimmed(data.headOfExpense),
    particulars: asTrimmed(data.particulars),
    vendor: asTrimmed(data.vendor),
    expenseType: data.expenseType || 'Revenue',
    expenseNature: data.expenseNature === EXPENSE_NATURE.VARIABLE
      ? EXPENSE_NATURE.VARIABLE
      : EXPENSE_NATURE.FIXED,
    amountType: AMOUNT_TYPES.includes(data.amountType) ? data.amountType : AMOUNT_TYPE.FIXED,
    netAmount: roundMoney(data.netAmount),
    gstPercent: Number(data.gstPercent) || 0,
    useIGST: data.useIGST === true || data.useIGST === 'true',
    tds: roundMoney(data.tds),
    merType: data.merType || 'Bank',
    paymentMethod: data.paymentMethod || undefined,
    frequency: data.frequency || 'Monthly',
    dueDayOfMonth,
    startDate,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
    nextDueDate,
    isActive: data.isActive !== false && data.isActive !== 'false',
    notes: asTrimmed(data.notes),
    createdBy: user._id,
    updatedBy: user._id,
  });
};

/**
 * Create a recurring schedule seeded from an already-created expense entry.
 * The entry itself represents the current period, so nextDueDate is set to the
 * NEXT occurrence. Used for the inline "Make this recurring" flow on the form.
 */
export const createTemplateFromExpense = async (expense, data, user) => {
  const frequency = expense.frequency && expense.frequency !== 'One-time'
    ? expense.frequency
    : (data.frequency && data.frequency !== 'One-time' ? data.frequency : 'Monthly');

  const baseDue = expense.dueDate
    ? new Date(expense.dueDate)
    : (expense.invoiceDate ? new Date(expense.invoiceDate) : new Date());
  const dueDayOfMonth = clampDueDay(data.recurringDueDay || baseDue.getDate());
  const startDate = data.recurringStartDate ? new Date(data.recurringStartDate) : baseDue;
  const endDate = data.recurringEndDate ? new Date(data.recurringEndDate) : undefined;
  const nextDueDate = advanceNextDueDate(baseDue, frequency, dueDayOfMonth);
  const isActive = !(endDate && nextDueDate > endDate);

  return RecurringExpenseTemplate.create({
    name: asTrimmed(data.scheduleName)
      || asTrimmed(expense.particulars)
      || asTrimmed(expense.coNames)
      || 'Recurring bill',
    company: asTrimmed(expense.company),
    location: asTrimmed(expense.location),
    coNames: asTrimmed(expense.coNames),
    headOfExpense: asTrimmed(expense.headOfExpense),
    particulars: asTrimmed(expense.particulars),
    vendor: asTrimmed(expense.vendor),
    expenseType: expense.expenseType || 'Revenue',
    expenseNature: EXPENSE_NATURE.FIXED,
    amountType: AMOUNT_TYPES.includes(expense.amountType) ? expense.amountType : AMOUNT_TYPE.FIXED,
    netAmount: roundMoney(
      expense.amountType === AMOUNT_TYPE.USAGE ? 0 : expense.netAmount,
    ),
    gstPercent: Number(expense.gstPercent) || 0,
    useIGST: Boolean(expense.useIGST),
    tds: roundMoney(expense.tds),
    merType: expense.merType || 'Bank',
    paymentMethod: expense.paymentMethod || undefined,
    frequency,
    dueDayOfMonth,
    startDate,
    endDate,
    nextDueDate,
    isActive,
    notes: asTrimmed(expense.notes),
    createdBy: user._id,
    updatedBy: user._id,
  });
};

export const updateTemplate = async (id, data, user) => {
  const template = await getTemplateById(id);
  const fields = [
    'name', 'company', 'location', 'coNames', 'headOfExpense', 'particulars', 'vendor',
    'expenseType', 'expenseNature', 'amountType', 'netAmount', 'gstPercent', 'useIGST', 'tds',
    'merType', 'paymentMethod', 'frequency', 'notes', 'isActive',
  ];

  for (const key of fields) {
    if (data[key] !== undefined) {
      if (key === 'useIGST') template.useIGST = data.useIGST === true || data.useIGST === 'true';
      else if (key === 'isActive') template.isActive = data.isActive !== false && data.isActive !== 'false';
      else if (key === 'netAmount' || key === 'tds') template[key] = roundMoney(data[key]);
      else if (typeof data[key] === 'string') template[key] = asTrimmed(data[key]);
      else template[key] = data[key];
    }
  }

  if (data.dueDayOfMonth !== undefined) {
    template.dueDayOfMonth = clampDueDay(data.dueDayOfMonth);
  }
  if (data.startDate) template.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) {
    template.endDate = data.endDate ? new Date(data.endDate) : undefined;
  }
  if (data.nextDueDate) template.nextDueDate = new Date(data.nextDueDate);

  template.updatedBy = user._id;
  await template.save();
  return template;
};

export const deleteTemplate = async (id) => {
  const template = await getTemplateById(id);
  await template.deleteOne();
  return { id };
};

/**
 * Create one expense instance from a template for its current nextDueDate,
 * then advance nextDueDate. Skips if an instance already exists for that due month.
 */
export const generateFromTemplate = async (templateId, user, { asOf = new Date() } = {}) => {
  const template = await getTemplateById(templateId);
  if (!template.isActive) throw ApiError.badRequest('Template is inactive');

  const asOfDate = new Date(asOf);
  if (template.nextDueDate > asOfDate) {
    return { skipped: true, reason: 'not_due_yet', template };
  }
  if (template.endDate && template.nextDueDate > template.endDate) {
    template.isActive = false;
    await template.save();
    return { skipped: true, reason: 'ended', template };
  }

  const dueDate = new Date(template.nextDueDate);
  const dayStart = new Date(dueDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dueDate);
  dayEnd.setHours(23, 59, 59, 999);

  const existing = await Expense.findOne({
    recurringTemplateId: template._id,
    dueDate: { $gte: dayStart, $lte: dayEnd },
    isDraft: { $ne: true },
  }).select('_id slNo').lean();

  if (existing) {
    if (template.frequency === 'One-time') {
      template.isActive = false;
    } else {
      template.nextDueDate = advanceNextDueDate(dueDate, template.frequency, template.dueDayOfMonth);
    }
    template.updatedBy = user._id;
    await template.save();
    return { skipped: true, reason: 'already_exists', expenseId: existing._id, template };
  }

  const amountType = AMOUNT_TYPES.includes(template.amountType)
    ? template.amountType
    : AMOUNT_TYPE.FIXED;
  const templateNet = amountType === AMOUNT_TYPE.USAGE ? 0 : template.netAmount;

  const calculated = applyCalculations({
    netAmount: templateNet,
    gstPercent: template.gstPercent,
    useIGST: template.useIGST,
    tds: amountType === AMOUNT_TYPE.USAGE ? 0 : template.tds,
  });

  const month = dueDate.toLocaleString('en-US', { month: 'long' });
  const merType = template.merType || 'Bank';
  const slNo = await resolveMerSerialForTemplate({
    company: template.company,
    month,
    invoiceDate: dueDate,
    merType,
  });

  const expense = await Expense.create({
    ...calculated,
    slNo,
    month,
    coNames: template.coNames,
    invoiceDate: dueDate,
    dueDate,
    location: template.location,
    company: template.company,
    headOfExpense: template.headOfExpense,
    particulars: template.particulars || template.name,
    vendor: template.vendor,
    expenseType: template.expenseType,
    expenseNature: template.expenseNature || EXPENSE_NATURE.FIXED,
    amountType,
    frequency: template.frequency || 'Monthly',
    merType,
    paymentMethod: template.paymentMethod,
    status: 'Pending',
    amountPaid: 0,
    balanceDue: calculated.grossAmount || 0,
    approvalStatus: APPROVAL_STATUS.PENDING,
    source: 'recurring',
    recurringTemplateId: template._id,
    notes: template.notes,
    isDraft: false,
    createdBy: user._id,
    updatedBy: user._id,
  });

  if (template.frequency === 'One-time') {
    template.isActive = false;
  } else {
    template.nextDueDate = advanceNextDueDate(dueDate, template.frequency, template.dueDayOfMonth);
    if (template.endDate && template.nextDueDate > template.endDate) {
      template.isActive = false;
    }
  }
  template.updatedBy = user._id;
  await template.save();

  return { skipped: false, expense, template };
};

/** Generate all templates that are due on or before asOf (catch-up loop per template). */
export const generateAllDue = async (user, { asOf = new Date(), maxPerTemplate = 12 } = {}) => {
  const asOfDate = new Date(asOf);
  const templates = await RecurringExpenseTemplate.find({
    isActive: true,
    nextDueDate: { $lte: asOfDate },
  });

  const results = [];
  for (const template of templates) {
    let generated = 0;
    // Catch up multiple missed periods (capped).
    while (generated < maxPerTemplate) {
      const fresh = await RecurringExpenseTemplate.findById(template._id);
      if (!fresh?.isActive || fresh.nextDueDate > asOfDate) break;
      const result = await generateFromTemplate(fresh._id, user, { asOf: asOfDate });
      results.push({ templateId: fresh._id, ...result });
      if (result.skipped && result.reason !== 'already_exists') break;
      generated += 1;
      if (result.skipped && result.reason === 'already_exists') {
        // nextDue already advanced; continue loop if still behind
        continue;
      }
    }
  }

  return {
    processed: results.length,
    created: results.filter((r) => !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  };
};
