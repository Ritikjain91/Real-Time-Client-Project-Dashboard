import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getTasks,
  getTask,
  handleCreateTask,
  handleUpdateStatus,
  handleUpdateTask,
  createTaskSchema,
  updateStatusSchema,
  updateTaskSchema,
} from '../controllers/task.controller';
import { requireAuth, requireRole, requireTaskAccess } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

router.get('/', getTasks);
router.get('/:id', requireTaskAccess, getTask);
router.post('/', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), validate(createTaskSchema), handleCreateTask);
router.patch('/:id/status', requireTaskAccess, validate(updateStatusSchema), handleUpdateStatus);
router.put('/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), requireTaskAccess, validate(updateTaskSchema), handleUpdateTask);

export default router;
