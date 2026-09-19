import { Role, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { JwtPayload } from '../types';

/**
 * Fetches database-stored activity logs filtered strictly by the user's role.
 * Used for offline catch-up (last 20 events) and live feed initialization.
 */
export const getActivityFeedForUser = async (user: JwtPayload, limit = 20) => {
  const take = Math.min(Math.max(1, limit), 50); // safety clamp between 1 and 50
  const where: Prisma.TaskActivityWhereInput = {};

  if (user.role === Role.ADMIN) {
    // Admin sees all activity across all projects
  } else if (user.role === Role.PROJECT_MANAGER) {
    // PM sees activity only from projects they manage
    where.project = {
      managerId: user.userId,
    };
  } else if (user.role === Role.DEVELOPER) {
    // Developer sees activity only on tasks assigned to them
    where.task = {
      assignedToId: user.userId,
    };
  }

  return prisma.taskActivity.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
};
