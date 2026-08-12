import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize('superadmin', 'admin'));

router.get('/due', notificationController.getDueNotifyConfig);
router.put('/due', notificationController.updateDueNotifyConfig);
router.post('/due/send', notificationController.sendDueNotifyNow);
router.post('/due/recipients/:recipientId/send', notificationController.sendDueNotifyToRecipient);

export default router;
