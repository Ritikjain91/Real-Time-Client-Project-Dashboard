import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';

export const getNotificationsForUser = async (userId: string, limit = 30) => {
  return prisma.notification.findMany({
    where: { userId },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          projectId: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
};

export const markAsRead = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }

  if (notification.userId !== userId) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

export const markAllAsRead = async (userId: string) => {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  });
};
