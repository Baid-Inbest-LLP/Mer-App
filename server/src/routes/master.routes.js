import { Router } from 'express';
import * as master from '../controllers/master.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/lookups', master.getLookupData);
router.get('/financial-years', master.getFinancialYears);

router.get('/vendors', master.vendorController.list);
router.post('/vendors', master.vendorController.create);
router.put('/vendors/:id', master.vendorController.update);
router.delete('/vendors/:id', master.vendorController.remove);

router.get('/companies', master.companyController.list);
router.post('/companies', authorize('superadmin', 'admin'), master.companyController.create);
router.put('/companies/:id', authorize('superadmin', 'admin'), master.companyController.update);
router.delete('/companies/:id', authorize('superadmin', 'admin'), master.companyController.remove);

router.get('/locations', master.locationController.list);
router.post('/locations', authorize('superadmin', 'admin'), master.locationController.create);
router.put('/locations/:id', authorize('superadmin', 'admin'), master.locationController.update);
router.delete('/locations/:id', authorize('superadmin', 'admin'), master.locationController.remove);

router.get('/expense-heads', master.expenseHeadController.list);
router.post('/expense-heads', authorize('superadmin', 'admin'), master.expenseHeadController.create);
router.put('/expense-heads/:id', authorize('superadmin', 'admin'), master.expenseHeadController.update);
router.delete('/expense-heads/:id', authorize('superadmin', 'admin'), master.expenseHeadController.remove);

router.get('/users', authorize('superadmin', 'admin'), master.listUsers);
router.put('/users/:id', authorize('superadmin', 'admin'), master.updateUser);
router.delete('/users/:id', authorize('superadmin', 'admin'), master.deleteUser);

export default router;
