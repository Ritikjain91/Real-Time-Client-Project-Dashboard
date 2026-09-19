import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import {
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notification.service';

export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForUser(userId),
    getUnreadCount(userId),
  ]);

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
    },
  });
};

export const handleMarkAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const updated = await markAsRead(id, req.user!.userId);
  const unreadCount = await getUnreadCount(req.user!.userId);

  res.json({
    success: true,
    data: {
      notification: updated,
      unreadCount,
    },
  });
};

export const handleMarkAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await markAllAsRead(req.user!.userId);

  res.json({
    success: true,
    data: {
      unreadCount: 0,
    },
  });
};
