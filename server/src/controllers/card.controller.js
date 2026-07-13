import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Card, Company } from '../models/index.js';

const normalizeLast4 = (value) => String(value || '').replace(/\D/g, '').slice(-4);

const toDto = (doc) => {
  const item = doc?.toObject ? doc.toObject() : { ...doc };
  return {
    ...item,
    displayValue: `${item.issuer} - ${item.last4}`,
  };
};

const resolveCompany = async (body = {}) => {
  if (body.company) {
    const company = await Company.findById(body.company).select('name').lean();
    if (!company) throw ApiError.badRequest('Company not found');
    return { company: company._id, companyName: company.name };
  }
  if (body.companyName) {
    const company = await Company.findOne({ name: body.companyName.trim() }).select('_id name').lean();
    if (company) return { company: company._id, companyName: company.name };
    return { company: undefined, companyName: body.companyName.trim() };
  }
  return { company: undefined, companyName: '' };
};

const normalizeBody = async (body = {}) => {
  const issuer = String(body.issuer || '').trim().toUpperCase();
  const last4 = normalizeLast4(body.last4);
  if (!issuer) throw ApiError.badRequest('Card issuer is required');
  if (!/^\d{4}$/.test(last4)) throw ApiError.badRequest('Last 4 digits are required');

  const cardType = body.cardType === 'Debit' ? 'Debit' : 'Credit';
  const companyFields = await resolveCompany(body);
  return {
    ...companyFields,
    issuer,
    last4,
    cardType,
    label: String(body.label || '').trim(),
    isActive: body.isActive !== false,
  };
};

export const getCards = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.activeOnly !== 'false') filter.isActive = { $ne: false };
  if (req.query.search) {
    const q = String(req.query.search).trim();
    filter.$or = [
      { issuer: { $regex: q, $options: 'i' } },
      { last4: { $regex: q, $options: 'i' } },
      { companyName: { $regex: q, $options: 'i' } },
      { label: { $regex: q, $options: 'i' } },
      { cardType: { $regex: q, $options: 'i' } },
    ];
  }

  const items = await Card.find(filter).sort({ issuer: 1, last4: 1 }).lean();
  ApiResponse.paginated(res, items.map(toDto), { total: items.length });
});

export const getCard = asyncHandler(async (req, res) => {
  const item = await Card.findById(req.params.id).lean();
  if (!item) throw ApiError.notFound('Card not found');
  ApiResponse.success(res, toDto(item));
});

export const createCard = asyncHandler(async (req, res) => {
  const payload = await normalizeBody(req.body);
  try {
    const item = await Card.create(payload);
    ApiResponse.created(res, toDto(item), 'Card created');
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('Card already exists');
    throw err;
  }
});

export const updateCard = asyncHandler(async (req, res) => {
  const payload = await normalizeBody(req.body);
  let item;
  try {
    item = await Card.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('Card already exists');
    throw err;
  }
  if (!item) throw ApiError.notFound('Card not found');
  ApiResponse.success(res, toDto(item), 'Card updated');
});

export const deleteCard = asyncHandler(async (req, res) => {
  const item = await Card.findByIdAndDelete(req.params.id);
  if (!item) throw ApiError.notFound('Card not found');
  ApiResponse.success(res, null, 'Card deleted');
});
