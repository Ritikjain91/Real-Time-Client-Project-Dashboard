import { Router } from 'express';
import { login, refresh, logout, getMe, getUsers, loginSchema } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.get('/users', requireAuth, getUsers);

export default router;
