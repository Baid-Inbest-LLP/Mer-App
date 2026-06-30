import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { config } from '../config/index.js';

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.message, err.statusCode, err.errors);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return ApiResponse.error(res, 'Validation failed', 400, errors);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return ApiResponse.error(res, `${field} already exists`, 409);
  }

  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.error(res, 'Token expired', 401);
  }

  console.error('Unhandled error:', err);
  const message = config.env === 'production' ? 'Internal server error' : err.message;
  return ApiResponse.error(res, message, 500);
};

export const notFoundHandler = (req, res) => {
  ApiResponse.error(res, `Route ${req.originalUrl} not found`, 404);
};
