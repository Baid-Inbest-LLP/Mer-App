import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/summary', reportController.getSummary);
router.get('/head-summary', reportController.getHeadSummary);
router.get('/monthly', reportController.getMonthlyReport);
router.get('/financial-year', reportController.getFinancialYearReport);
router.get('/monthly/detailed', reportController.getMonthlyDetailed);
router.get('/export/excel', reportController.exportSummaryExcel);
router.get('/export/monthly', reportController.exportMonthlyExcel);
router.get('/export/monthly/pdf', reportController.exportMonthlyPdf);

export default router;
