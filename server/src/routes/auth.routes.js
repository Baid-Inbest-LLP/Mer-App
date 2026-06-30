import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  loginValidator,
  registerValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  changePasswordValidator,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/login', loginValidator, validate, authController.login);
router.post('/refresh', refreshTokenValidator, validate, authController.refreshToken);
router.post('/forgot-password', forgotPasswordValidator, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, authController.resetPassword);
router.post(
  '/register',
  registerValidator,
  validate,
  authenticate,
  authorize('superadmin', 'admin'),
  authController.register,
);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put(
  '/change-password',
  authenticate,
  changePasswordValidator,
  validate,
  authController.changePassword,
);

export default router;
