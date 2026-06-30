import { Router } from 'express';
import authRoutes from './auth.routes.js';
import expenseRoutes from './expense.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import reportRoutes from './report.routes.js';
import analyticsRoutes from './analytics.routes.js';
import masterRoutes from './master.routes.js';
import companyRoutes from './company.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'MER API is running', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/expenses', expenseRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/masters', masterRoutes);
router.use('/companies', companyRoutes);

export default router;
