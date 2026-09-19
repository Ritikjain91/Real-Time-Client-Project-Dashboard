import { Router } from 'express';
import {
  getNotifications,
  handleMarkAsRead,
  handleMarkAllAsRead,
} from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/:id/read', handleMarkAsRead);
router.post('/read-all', handleMarkAllAsRead);

export default router;
