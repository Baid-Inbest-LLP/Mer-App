import { Router } from 'express';
import * as companyController from '../controllers/company.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', companyController.getCompanies);
router.post('/', authorize('superadmin', 'admin'), companyController.createCompany);
router.get('/:id/stamp', companyController.getCompanyStamp);
router.get('/:id', companyController.getCompany);
router.put('/:id', authorize('superadmin', 'admin'), companyController.updateCompany);
router.delete('/:id', authorize('superadmin', 'admin'), companyController.deleteCompany);

export default router;
