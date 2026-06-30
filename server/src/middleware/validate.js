import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest(
      'Validation failed',
      errors.array().map((e) => ({ field: e.path, message: e.msg })),
    );
  }
  next();
};
