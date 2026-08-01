import app from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { ensureDefaultUsers, ensureSuperAdminAccount, bootstrapCompanies } from './seed/bootstrap.js';

const start = async () => {
  await connectDatabase();
  await ensureDefaultUsers();
  await ensureSuperAdminAccount();
  const { migrateApprovalStatus } = await import('./services/expense.service.js');
  await migrateApprovalStatus();
  const { migratePaymentLedger, migratePaidBillsToCompleted } = await import('./services/payment.service.js');
  await migratePaymentLedger();
  await migratePaidBillsToCompleted();
  await bootstrapCompanies();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`MER Server running on port ${config.port} [${config.env}]`);
  });
};

start();
