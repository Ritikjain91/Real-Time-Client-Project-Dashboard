import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getProjects,
  getProject,
  handleCreateProject,
  getClients,
  createProjectSchema,
} from '../controllers/project.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

router.get('/', getProjects);
router.get('/meta/clients', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), getClients);
router.get('/:id', getProject);
router.post(
  '/',
  requireRole(Role.ADMIN, Role.PROJECT_MANAGER),
  validate(createProjectSchema),
  handleCreateProject
);

export default router;
