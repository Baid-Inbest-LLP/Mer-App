import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokenUtils.js';
import { User } from '../models/User.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token required');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);
  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User not found or inactive');
  }

  req.user = user;
  next();
});

export const authorize = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
    next();
  });
