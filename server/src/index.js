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
  await bootstrapCompanies();
  app.listen(config.port, () => {
    console.log(`MER Server running on port ${config.port} [${config.env}]`);
  });
};

start();
