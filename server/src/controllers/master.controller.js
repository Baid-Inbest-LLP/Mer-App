import { asyncHandler } from '../utils/asyncHandler.js';
import { PAYMENT_METHODS } from '../constants/paymentMethods.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Vendor, Company, Location, ExpenseHead, FinancialYear, User } from '../models/index.js';
import { EXPENSE_HEADS, getFinancialYear, APPROVAL_STATUSES, USER_ROLES } from '../config/index.js';
import { normalizeBranchLabel } from '../utils/locationFormat.js';
import { ApiError } from '../utils/ApiError.js';

const crud = (Model, name) => ({
  list: asyncHandler(async (req, res) => {
    const filter = req.query.activeOnly === 'false' ? {} : { isActive: { $ne: false } };
    const items = await Model.find(filter).sort({ name: 1 }).lean();
    ApiResponse.success(res, items);
  }),
  create: asyncHandler(async (req, res) => {
    const item = await Model.create(req.body);
    ApiResponse.created(res, item, `${name} created`);
  }),
  update: asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) throw ApiError.notFound(`${name} not found`);
    ApiResponse.success(res, item, `${name} updated`);
  }),
  remove: asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) throw ApiError.notFound(`${name} not found`);
    ApiResponse.success(res, null, `${name} deleted`);
  }),
});

export const vendorController = crud(Vendor, 'Vendor');
export const companyController = crud(Company, 'Company');
export const locationController = crud(Location, 'Location');
export const expenseHeadController = crud(ExpenseHead, 'Expense head');

export const getLookupData = asyncHandler(async (_req, res) => {
  const [vendors, companies, locationDocs, heads] = await Promise.all([
    Vendor.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
    Company.find({ isActive: true }).select('name code').sort({ name: 1 }).lean(),
    Location.find({ isActive: true })
      .populate('company', 'name')
      .select('name label company isDefault')
      .sort({ label: 1 })
      .lean(),
    ExpenseHead.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
  ]);

  const companyLocations = {};
  for (const loc of locationDocs) {
    const companyName = loc.company?.name;
    if (!companyName) continue;
    if (!companyLocations[companyName]) companyLocations[companyName] = [];
    const branchLabel = normalizeBranchLabel(loc.label);
    if (branchLabel) companyLocations[companyName].push(branchLabel);
  }

  const branchLabels = [
    ...new Set(
      locationDocs.map((l) => normalizeBranchLabel(l.label)).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  ApiResponse.success(res, {
    vendors: vendors.map((v) => v.name),
    companies: companies.map((c) => c.name),
    companyCodeByName: Object.fromEntries(
      companies.filter((c) => c.name && c.code).map((c) => [c.name, c.code]),
    ),
    locations: branchLabels,
    companyLocations,
    expenseHeads: heads.length ? heads.map((h) => h.name) : EXPENSE_HEADS,
    expenseTypes: ['Capital', 'Revenue'],
    paymentMethods: PAYMENT_METHODS,
    statuses: ['Paid', 'Pending', 'Cancelled'],
    approvalStatuses: APPROVAL_STATUSES,
    roles: USER_ROLES,
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
    currentFinancialYear: getFinancialYear(),
  });
});

export const getFinancialYears = asyncHandler(async (_req, res) => {
  let years = await FinancialYear.find().sort({ startDate: -1 }).lean();
  if (!years.length) {
    const current = getFinancialYear();
    const [sy] = current.split('-').map(Number);
    years = [{ label: current, startDate: new Date(sy, 3, 1), isCurrent: true }];
  }
  ApiResponse.success(res, years);
});

const canManageUser = (actorRole, targetRole) => {
  if (actorRole === 'superadmin') return targetRole !== 'superadmin';
  if (actorRole === 'admin') return targetRole === 'user';
  return false;
};

export const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'admin') {
    filter.role = { $in: ['admin', 'user'] };
  }
  const users = await User.find(filter).select('-password').sort({ name: 1 });
  ApiResponse.success(res, users);
});

export const updateUser = asyncHandler(async (req, res) => {
  const actor = req.user;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  if (user._id.equals(actor._id) && actor.role === 'admin') {
    throw ApiError.forbidden('You cannot edit your own account here');
  }
  if (!canManageUser(actor.role, user.role)) {
    throw ApiError.forbidden('You do not have permission to manage this user');
  }

  const { name, email, isActive } = req.body;
  if (name !== undefined) user.name = name;
  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalized, _id: { $ne: user._id } });
    if (existing) throw ApiError.conflict('Email already in use');
    user.email = normalized;
  }
  if (isActive !== undefined) user.isActive = Boolean(isActive);

  await user.save();
  ApiResponse.success(res, user, 'User updated');
});

export const deleteUser = asyncHandler(async (req, res) => {
  const actor = req.user;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  if (user._id.equals(actor._id)) {
    throw ApiError.forbidden('You cannot delete your own account');
  }
  if (user.role === 'superadmin') {
    throw ApiError.forbidden('Superadmin users cannot be deleted');
  }
  if (!canManageUser(actor.role, user.role)) {
    throw ApiError.forbidden('You do not have permission to delete this user');
  }

  await User.findByIdAndDelete(req.params.id);
  ApiResponse.success(res, null, 'User deleted');
});
