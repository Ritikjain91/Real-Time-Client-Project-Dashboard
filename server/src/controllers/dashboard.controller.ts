import { Response } from 'express';
import { Role, TaskStatus, TaskPriority } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../lib/prisma';
import { presenceTracker } from '../sockets/presence';

export const getDashboardMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!;

  if (user.role === Role.ADMIN) {
    // 1. Admin Metrics
    const [totalProjects, totalTasks, tasksByStatusRaw, overdueCount] = await Promise.all([
      prisma.project.count(),
      prisma.task.count(),
      prisma.task.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.task.count({
        where: { isOverdue: true, status: { not: TaskStatus.DONE } },
      }),
    ]);

    const tasksByStatus = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    tasksByStatusRaw.forEach((item) => {
      tasksByStatus[item.status] = item._count._all;
    });

    const activeUsersOnline = presenceTracker.getOnlineCount();

    res.json({
      success: true,
      data: {
        role: Role.ADMIN,
        totalProjects,
        totalTasks,
        tasksByStatus,
        overdueCount,
        activeUsersOnline,
      },
    });
    return;
  }

  if (user.role === Role.PROJECT_MANAGER) {
    // 2. PM Metrics: their projects summary, tasks by priority, upcoming due dates this week
    const now = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const [managedProjects, tasksByPriorityRaw, upcomingTasksThisWeek, overdueCount] = await Promise.all([
      prisma.project.findMany({
        where: { managerId: user.userId },
        include: {
          client: { select: { name: true, company: true } },
          _count: { select: { tasks: true } },
        },
      }),
      prisma.task.groupBy({
        by: ['priority'],
        where: {
          project: { managerId: user.userId },
        },
        _count: { _all: true },
      }),
      prisma.task.findMany({
        where: {
          project: { managerId: user.userId },
          status: { not: TaskStatus.DONE },
          dueDate: {
            gte: now,
            lte: endOfWeek,
          },
        },
        include: {
          project: { select: { id: true, title: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.task.count({
        where: {
          project: { managerId: user.userId },
          isOverdue: true,
          status: { not: TaskStatus.DONE },
        },
      }),
    ]);

    const tasksByPriority = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    tasksByPriorityRaw.forEach((item) => {
      tasksByPriority[item.priority] = item._count._all;
    });

    res.json({
      success: true,
      data: {
        role: Role.PROJECT_MANAGER,
        projectsCount: managedProjects.length,
        projects: managedProjects,
        tasksByPriority,
        upcomingTasksThisWeek,
        overdueCount,
      },
    });
    return;
  }

  if (user.role === Role.DEVELOPER) {
    // 3. Developer Metrics: assigned tasks, sorted by priority then due date
    const assignedTasks = await prisma.task.findMany({
      where: { assignedToId: user.userId },
      include: {
        project: { select: { id: true, title: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });

    const pendingCount = assignedTasks.filter((t) => t.status !== TaskStatus.DONE).length;
    const completedCount = assignedTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const overdueCount = assignedTasks.filter((t) => t.isOverdue && t.status !== TaskStatus.DONE).length;

    res.json({
      success: true,
      data: {
        role: Role.DEVELOPER,
        totalAssigned: assignedTasks.length,
        pendingCount,
        completedCount,
        overdueCount,
        tasks: assignedTasks,
      },
    });
    return;
  }

  res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Unknown role' } });
};
