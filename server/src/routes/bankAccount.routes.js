import { Router } from 'express';
import * as bankAccountController from '../controllers/bankAccount.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', bankAccountController.getBankAccounts);
router.post('/', authorize('superadmin', 'admin'), bankAccountController.createBankAccount);
router.get('/:id', bankAccountController.getBankAccount);
router.put('/:id', authorize('superadmin', 'admin'), bankAccountController.updateBankAccount);
router.delete('/:id', authorize('superadmin', 'admin'), bankAccountController.deleteBankAccount);

export default router;
