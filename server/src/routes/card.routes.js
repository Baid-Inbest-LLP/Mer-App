import { Router } from 'express';
import * as cardController from '../controllers/card.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', cardController.getCards);
router.post('/', authorize('superadmin', 'admin'), cardController.createCard);
router.get('/:id', cardController.getCard);
router.put('/:id', authorize('superadmin', 'admin'), cardController.updateCard);
router.delete('/:id', authorize('superadmin', 'admin'), cardController.deleteCard);

export default router;
