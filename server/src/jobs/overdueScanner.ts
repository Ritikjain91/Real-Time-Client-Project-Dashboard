import cron from 'node-cron';
import { TaskStatus, ActivityAction, NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config/env';
import { broadcastTaskActivity, broadcastNotification } from '../sockets/socketServer';

/**
 * Scans active tasks where the due date has elapsed and flags them as Overdue.
 * Records the change in the database ActivityLog and emits real-time updates.
 */
export const scanForOverdueTasks = async (): Promise<number> => {
  const now = new Date();

  try {
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { not: TaskStatus.DONE },
        isOverdue: false,
      },
      include: {
        project: {
          select: { id: true, title: true, managerId: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (overdueTasks.length === 0) {
      return 0;
    }

    logger.info(`Overdue Scanner: Found ${overdueTasks.length} task(s) past deadline.`);

    // System user representation for automated background updates
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, name: true },
    });
    const systemUserId = adminUser?.id;

    for (const task of overdueTasks) {
      // 1. Update task isOverdue flag
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: { isOverdue: true },
        include: {
          project: {
            select: { id: true, title: true, managerId: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 2. Insert TaskActivity log entry into DB
      let activity = null;
      if (systemUserId) {
        activity = await prisma.taskActivity.create({
          data: {
            taskId: task.id,
            projectId: task.projectId,
            userId: systemUserId,
            action: ActivityAction.TASK_OVERDUE,
            previousStatus: task.status,
            newStatus: task.status,
            details: `System flagged Task "${task.title}" as Overdue · deadline was ${task.dueDate.toLocaleDateString()}`,
          },
          include: {
            user: { select: { id: true, name: true, role: true } },
            task: { select: { id: true, title: true } },
            project: { select: { id: true, title: true } },
          },
        });
      }

      // 3. Notify the assigned Developer
      if (task.assignedToId) {
        const devNotif = await prisma.notification.create({
          data: {
            userId: task.assignedToId,
            taskId: task.id,
            type: NotificationType.TASK_OVERDUE,
            title: 'Task Overdue',
            message: `Task "${task.title}" in ${task.project.title} is now overdue.`,
          },
        });
        broadcastNotification(task.assignedToId, devNotif);
      }

      // 4. Notify the Project Manager
      const pmNotif = await prisma.notification.create({
        data: {
          userId: task.project.managerId,
          taskId: task.id,
          type: NotificationType.TASK_OVERDUE,
          title: 'Task Overdue',
          message: `Task "${task.title}" assigned to ${task.assignedTo?.name || 'Unassigned'} has exceeded its deadline.`,
        },
      });
      broadcastNotification(task.project.managerId, pmNotif);

      // 5. Broadcast real-time activity and task update
      if (activity) {
        broadcastTaskActivity({
          projectId: task.projectId,
          managerId: task.project.managerId,
          assignedToId: task.assignedToId,
          task: updatedTask,
          activity,
        });
      }
    }

    return overdueTasks.length;
  } catch (error: any) {
    logger.error('Error executing overdue task scanner:', error);
    return 0;
  }
};

/**
 * Initializes the node-cron scheduler
 */
export const startOverdueTaskScheduler = (): cron.ScheduledTask => {
  logger.info(`Starting Overdue Task Scheduler with cron expression: "${config.cron.overdueScanner}"`);

  // Run initial scan on startup to catch anything that slipped while server was restarting
  scanForOverdueTasks().catch((err) => {
    logger.error('Initial startup overdue scan failed:', err);
  });

  return cron.schedule(config.cron.overdueScanner, async () => {
    await scanForOverdueTasks();
  });
};
