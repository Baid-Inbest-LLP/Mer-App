import { Router } from 'express';
import { param, query } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as poIntegrationService from '../services/poIntegration.service.js';

const router = Router();

router.use(authenticate);

router.get(
  '/completed',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  validate,
  asyncHandler(async (req, res) => {
    const result = await poIntegrationService.listCompletedPurchaseOrders(req.query);
    ApiResponse.paginated(res, result.orders, result.pagination);
  }),
);

router.get(
  '/:id/expense-draft',
  param('id').isMongoId().withMessage('Invalid purchase order ID'),
  validate,
  asyncHandler(async (req, res) => {
    const result = await poIntegrationService.getPurchaseOrderExpenseDraft(req.params.id);
    ApiResponse.success(res, result);
  }),
);

router.post(
  '/:id/exclude',
  param('id').isMongoId().withMessage('Invalid purchase order ID'),
  validate,
  asyncHandler(async (req, res) => {
    const result = await poIntegrationService.excludePurchaseOrderExpense(req.params.id, req.user);
    ApiResponse.success(res, result, 'Purchase order excluded from MER expenses');
  }),
);

router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid purchase order ID'),
  validate,
  asyncHandler(async (req, res) => {
    const result = await poIntegrationService.getPurchaseOrderById(req.params.id);
    ApiResponse.success(res, result);
  }),
);

export default router;
