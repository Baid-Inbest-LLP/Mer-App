import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { Expense } from '../models/Expense.js';
import { ApiError } from '../utils/ApiError.js';
import { isAdminRole } from '../constants/roles.js';
import { canDeleteExpense } from '../utils/expensePermissions.js';

/** Only POs final-approved by Superadmin (`status: completed`) can become MER expenses. */
const FINAL_APPROVED_PO_STATUS = 'completed';

const STATUS_LABELS = {
  pending: 'Pending',
  approved_by_admin: 'Completed',
  completed: 'Approved',
  rejected: 'Rejected',
};

let poConnection = null;

const vendorSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    contactPerson: String,
  },
  { collection: 'vendors' },
);

const companySchema = new mongoose.Schema(
  {
    name: String,
    companyCode: String,
    phone: String,
  },
  { collection: 'companies' },
);

const poUserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
  },
  { collection: 'users' },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: String,
    status: String,
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'PoCompany' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'PoVendor' },
    department: String,
    shippingAddress: {
      label: String,
      company: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    orderDate: Date,
    expectedDeliveryDate: Date,
    completedAt: Date,
    approvedByAdminAt: Date,
    lineItems: [
      {
        description: String,
        quantity: Number,
        unit: String,
        unitPrice: Number,
        discount: Number,
        gstRate: Number,
        gstAmount: Number,
        totalPrice: Number,
      },
    ],
    subtotal: Number,
    shippingCost: Number,
    totalAmount: Number,
    notes: String,
    terms: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PoUser' },
    approvedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'PoUser' },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PoUser' },
  },
  { collection: 'purchaseorders', timestamps: true },
);

const getPoModels = async () => {
  if (!config.poMongodbUri) {
    throw ApiError.badRequest(
      'PO integration is not configured. Set PO_MONGODB_URI on the MER server.',
    );
  }

  if (!poConnection) {
    poConnection = await mongoose.createConnection(config.poMongodbUri).asPromise();
  }

  const PoVendor =
    poConnection.models.PoVendor || poConnection.model('PoVendor', vendorSchema);
  const PoCompany =
    poConnection.models.PoCompany || poConnection.model('PoCompany', companySchema);
  const PoUser =
    poConnection.models.PoUser || poConnection.model('PoUser', poUserSchema);
  const PurchaseOrder =
    poConnection.models.PoPurchaseOrder
    || poConnection.model('PoPurchaseOrder', purchaseOrderSchema);

  return { PurchaseOrder, PoVendor, PoCompany, PoUser };
};

const lineNet = (item) => {
  const base = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const discount = Number(item.discount) || 0;
  return base * (1 - discount / 100);
};

const lineGstAmount = (item) => {
  const stored = Number(item.gstAmount);
  if (stored > 0) return stored;
  const rate = Number(item.gstRate) || 0;
  if (rate <= 0) return 0;
  return lineNet(item) * (rate / 100);
};

const resolvePoGstAmount = (lineItems = []) =>
  parseFloat(
    lineItems.reduce((sum, item) => sum + lineGstAmount(item), 0).toFixed(2),
  );

const buildNotesFromLineItems = (po) => {
  const lines = (po.lineItems || [])
    .map((item) => {
      const description = (item.description || 'Item').trim();
      const qty = Number(item.quantity) || 0;
      const unit = (item.unit || 'pcs').trim();
      return `${description} — ${qty} ${unit}`;
    })
    .filter(Boolean);

  return lines.join('\n');
};

const mapPoToListItem = (po, linkedByPoId) => {
  const id = po._id.toString();
  const linkedExpense = linkedByPoId.get(id) || null;
  return {
    _id: id,
    poNumber: po.poNumber,
    status: po.status,
    statusLabel: STATUS_LABELS[po.status] || po.status,
    company: po.company?.name || '',
    companyCode: po.company?.companyCode || '',
    vendor: po.vendor?.name || '',
    location: po.shippingAddress?.label || '',
    orderDate: po.orderDate,
    completedAt: po.completedAt || po.approvedByAdminAt || null,
    totalAmount: po.totalAmount || 0,
    alreadyImported: Boolean(linkedExpense),
    linkedExpenseId: linkedExpense?._id?.toString() || null,
    linkedExpenseSlNo: linkedExpense?.slNo || null,
  };
};

export const mapPoToExpenseDraft = (po) => {
  const invoiceDate = po.orderDate ? new Date(po.orderDate) : new Date();
  const month = invoiceDate.toLocaleString('en-US', { month: 'long' });
  // Pre-GST amount only: Σ((unitPrice × qty) − discount) — excludes GST.
  // Keep full decimals in the form input; summary rounds for display.
  const netAmount = parseFloat(
    (po.lineItems || []).reduce((sum, item) => sum + lineNet(item), 0).toFixed(2),
  );
  const gstAmount = resolvePoGstAmount(po.lineItems);
  const gstPercent = netAmount > 0
    ? parseFloat(((gstAmount / netAmount) * 100).toFixed(2))
    : 0;

  return {
    purchaseOrderId: po._id.toString(),
    poNumber: po.poNumber,
    company: po.company?.name || '',
    coNames: po.vendor?.name || '',
    vendor: po.vendor?.name || '',
    location: po.shippingAddress?.label || '',
    invoiceDate: invoiceDate.toISOString(),
    month,
    invoiceNo: po.poNumber,
    particulars: '',
    notes: buildNotesFromLineItems(po),
    terms: `Expense Imported from purchase order ${po.poNumber}`,
    netAmount,
    gstAmount,
    gstPercent,
    useIGST: false,
    tds: 0,
    expenseType: 'Revenue',
    hasBillOrReceipt: false,
    source: 'purchase_order',
  };
};

export const listCompletedPurchaseOrders = async ({ page = 1, limit = 20, search } = {}) => {
  const { PurchaseOrder } = await getPoModels();
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const filter = { status: FINAL_APPROVED_PO_STATUS };
  if (search?.trim()) {
    filter.poNumber = { $regex: search.trim(), $options: 'i' };
  }

  const [total, orders, linked] = await Promise.all([
    PurchaseOrder.countDocuments(filter),
    PurchaseOrder.find(filter)
      .populate('vendor', 'name phone')
      .populate('company', 'name companyCode')
      .sort({ completedAt: -1, approvedByAdminAt: -1, createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean(),
    Expense.find({ purchaseOrderId: { $ne: null } })
      .select('purchaseOrderId slNo')
      .lean(),
  ]);

  const linkedByPoId = new Map(
    linked
      .filter((e) => e.purchaseOrderId)
      .map((e) => [e.purchaseOrderId.toString(), e]),
  );

  return {
    orders: orders.map((po) => mapPoToListItem(po, linkedByPoId)),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 0,
    },
  };
};

const populatePoDetail = (query) =>
  query
    .populate('vendor', 'name phone contactPerson')
    .populate('company', 'name companyCode phone')
    .populate('createdBy', 'name email')
    .populate('approvedByAdmin', 'name email')
    .populate('completedBy', 'name email');

export const getPurchaseOrderById = async (poId) => {
  if (!mongoose.Types.ObjectId.isValid(poId)) {
    throw ApiError.badRequest('Invalid purchase order ID');
  }

  const { PurchaseOrder } = await getPoModels();
  const po = await populatePoDetail(PurchaseOrder.findById(poId)).lean();

  if (!po) throw ApiError.notFound('Purchase order not found');
  if (po.status !== FINAL_APPROVED_PO_STATUS) {
    throw ApiError.badRequest(
      'Only purchase orders final-approved by Superadmin are available in MER',
    );
  }

  const linkedExpense = await Expense.findOne({ purchaseOrderId: po._id.toString() })
    .select('_id slNo isDraft approvalStatus')
    .lean();

  const linkedByPoId = new Map();
  if (linkedExpense) {
    linkedByPoId.set(po._id.toString(), linkedExpense);
  }

  return {
    ...po,
    statusLabel: STATUS_LABELS[po.status] || po.status,
    alreadyImported: Boolean(linkedExpense),
    linkedExpenseId: linkedExpense?._id?.toString() || null,
    linkedExpenseSlNo: linkedExpense?.slNo || null,
    listSummary: mapPoToListItem(po, linkedByPoId),
  };
};

export const excludePurchaseOrderExpense = async (poId, user) => {
  if (!mongoose.Types.ObjectId.isValid(poId)) {
    throw ApiError.badRequest('Invalid purchase order ID');
  }

  const expense = await Expense.findOne({ purchaseOrderId: poId.toString() });
  if (!expense) {
    throw ApiError.notFound('No MER expense is linked to this purchase order');
  }

  const allowed = canDeleteExpense(expense, user) || isAdminRole(user.role);
  if (!allowed) {
    throw ApiError.forbidden(
      'You do not have permission to exclude this purchase order from MER expenses',
    );
  }

  const removed = {
    expenseId: expense._id.toString(),
    slNo: expense.slNo || null,
    poNumber: expense.poNumber || null,
  };

  await expense.deleteOne();
  return removed;
};

export const getPurchaseOrderExpenseDraft = async (poId) => {
  if (!mongoose.Types.ObjectId.isValid(poId)) {
    throw ApiError.badRequest('Invalid purchase order ID');
  }

  const { PurchaseOrder } = await getPoModels();
  const po = await PurchaseOrder.findById(poId)
    .populate('vendor', 'name phone')
    .populate('company', 'name companyCode')
    .lean();

  if (!po) throw ApiError.notFound('Purchase order not found');
  if (po.status !== FINAL_APPROVED_PO_STATUS) {
    throw ApiError.badRequest(
      'Only purchase orders final-approved by Superadmin can be added as MER expenses',
    );
  }

  const existing = await Expense.findOne({ purchaseOrderId: po._id.toString() })
    .select('_id slNo isDraft')
    .lean();
  if (existing) {
    throw ApiError.conflict(
      `This PO is already linked to MER entry ${existing.slNo || existing._id}`,
    );
  }

  return {
    po: mapPoToListItem(po, new Map()),
    draft: mapPoToExpenseDraft(po),
  };
};
