import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { getActivityFeedForUser } from '../services/activity.service';

export const getActivityFeed = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const activities = await getActivityFeedForUser(req.user!, limit);

  res.json({
    success: true,
    data: activities,
  });
};
