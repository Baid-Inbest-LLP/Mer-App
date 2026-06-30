import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/trends', analyticsController.getTrends);
router.get('/expense-types', analyticsController.getExpenseTypes);
router.get('/payment-methods', analyticsController.getPaymentMethods);
router.get('/company-chart', analyticsController.getCompanyChart);
router.get('/heads', analyticsController.getHeadAnalytics);
router.get('/expense-heads', analyticsController.getHeadAnalytics);
router.get('/quarterly', analyticsController.getQuarterly);
router.get('/fy-comparison', analyticsController.getFYComparison);

export default router;
