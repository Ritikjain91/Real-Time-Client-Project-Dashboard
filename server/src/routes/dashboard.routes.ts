import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/metrics', getDashboardMetrics);

export default router;
