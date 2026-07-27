import { Router } from 'express';
import * as recurringController from '../controllers/recurring.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createRecurringValidator,
  recurringIdValidator,
} from '../validators/recurring.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', recurringController.listTemplates);
router.post('/generate-due', recurringController.generateAllDue);
router.post('/', createRecurringValidator, validate, recurringController.createTemplate);
router.get('/:id', recurringIdValidator, validate, recurringController.getTemplate);
router.put('/:id', recurringIdValidator, validate, recurringController.updateTemplate);
router.delete('/:id', recurringIdValidator, validate, recurringController.deleteTemplate);
router.post(
  '/:id/generate',
  recurringIdValidator,
  validate,
  recurringController.generateTemplate,
);

export default router;
