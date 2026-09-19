import { Role, TaskStatus, TaskPriority, ActivityAction, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { JwtPayload, TaskFilterParams } from '../types';
import { broadcastTaskActivity, broadcastNotification } from '../sockets/socketServer';

/**
 * Format status for human-readable display in activity feed
 */
const formatStatus = (status: TaskStatus): string => {
  switch (status) {
    case TaskStatus.TODO:
      return 'To Do';
    case TaskStatus.IN_PROGRESS:
      return 'In Progress';
    case TaskStatus.IN_REVIEW:
      return 'In Review';
    case TaskStatus.DONE:
      return 'Done';
    default:
      return status;
  }
};

export const getTasksForUser = async (user: JwtPayload, filters: TaskFilterParams) => {
  const where: Prisma.TaskWhereInput = {};

  // 1. Enforce Role Scoping
  if (user.role === Role.DEVELOPER) {
    // Developers can ONLY see tasks assigned to them
    where.assignedToId = user.userId;
  } else if (user.role === Role.PROJECT_MANAGER) {
    // PM can ONLY see tasks within projects they manage
    where.project = { managerId: user.userId };
  }
  // Admin sees all tasks without role restrictions

  // 2. Apply Filters (Status, Priority, Project, Date Range, Search)
  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.projectId) {
    if (user.role === Role.PROJECT_MANAGER) {
      // Ensure the PM actually owns the filtered project
      where.project = { id: filters.projectId, managerId: user.userId };
    } else {
      where.projectId = filters.projectId;
    }
  }

  if (filters.assignedToId && user.role !== Role.DEVELOPER) {
    where.assignedToId = filters.assignedToId;
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {};
    if (filters.dueDateFrom) {
      where.dueDate.gte = new Date(filters.dueDateFrom);
    }
    if (filters.dueDateTo) {
      where.dueDate.lte = new Date(filters.dueDateTo);
    }
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.task.findMany({
    where,
    include: {
      project: {
        select: { id: true, title: true, managerId: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    // Developer dashboard: sorted by priority then due date
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
    ],
  });
};

export const getTaskById = async (taskId: string, user: JwtPayload) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: { id: true, title: true, managerId: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      activities: {
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task) {
    throw new AppError('Task not found', 404, 'NOT_FOUND');
  }

  // Role permissions
  if (user.role === Role.DEVELOPER && task.assignedToId !== user.userId) {
    throw new AppError('Access denied. You can only view tasks assigned to you.', 403, 'FORBIDDEN');
  }

  if (user.role === Role.PROJECT_MANAGER && task.project.managerId !== user.userId) {
    throw new AppError('Access denied. You can only view tasks within your projects.', 403, 'FORBIDDEN');
  }

  return task;
};

export interface CreateTaskInput {
  title: string;
  description: string;
  projectId: string;
  assignedToId?: string;
  priority?: TaskPriority;
  dueDate: string;
}

export const createTask = async (data: CreateTaskInput, user: JwtPayload) => {
  if (user.role === Role.DEVELOPER) {
    throw new AppError('Developers are not permitted to create tasks', 403, 'FORBIDDEN');
  }

  // Validate project ownership for PM
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { id: true, title: true, managerId: true },
  });

  if (!project) {
    throw new AppError('Project not found', 404, 'NOT_FOUND');
  }

  if (user.role === Role.PROJECT_MANAGER && project.managerId !== user.userId) {
    throw new AppError('You can only create tasks in projects you manage', 403, 'FORBIDDEN');
  }

  // Validate assignee if provided
  if (data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { id: true, role: true, name: true },
    });
    if (!assignee) {
      throw new AppError('Assigned developer not found', 400, 'INVALID_ASSIGNEE');
    }
  }

  const dueDate = new Date(data.dueDate);
  const isOverdue = dueDate < new Date();

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      assignedToId: data.assignedToId || null,
      priority: data.priority || TaskPriority.MEDIUM,
      dueDate,
      isOverdue,
      status: TaskStatus.TODO,
    },
    include: {
      project: { select: { id: true, title: true, managerId: true } },
      assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  // Create Activity Log in database
  const activity = await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      projectId: task.projectId,
      userId: user.userId,
      action: ActivityAction.TASK_CREATED,
      newStatus: TaskStatus.TODO,
      details: `${user.name} created Task "${task.title}"`,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
      task: { select: { id: true, title: true } },
      project: { select: { id: true, title: true } },
    },
  });

  // Notify assigned developer if applicable
  if (task.assignedToId && task.assignedToId !== user.userId) {
    const notification = await prisma.notification.create({
      data: {
        userId: task.assignedToId,
        taskId: task.id,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New Task Assigned',
        message: `You were assigned to "${task.title}" in ${task.project.title}`,
      },
    });
    broadcastNotification(task.assignedToId, notification);
  }

  // Broadcast real-time activity and task creation
  broadcastTaskActivity({
    projectId: task.projectId,
    managerId: project.managerId,
    assignedToId: task.assignedToId,
    task,
    activity,
  });

  return task;
};

export const updateTaskStatus = async (
  taskId: string,
  newStatus: TaskStatus,
  user: JwtPayload
) => {
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, title: true, managerId: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!existingTask) {
    throw new AppError('Task not found', 404, 'NOT_FOUND');
  }

  // Developer can ONLY update tasks assigned to them
  if (user.role === Role.DEVELOPER && existingTask.assignedToId !== user.userId) {
    throw new AppError('Developers can only update tasks assigned to them', 403, 'FORBIDDEN');
  }

  // PM can ONLY update tasks within their projects
  if (user.role === Role.PROJECT_MANAGER && existingTask.project.managerId !== user.userId) {
    throw new AppError('You can only update tasks in projects you manage', 403, 'FORBIDDEN');
  }

  const prevStatus = existingTask.status;
  if (prevStatus === newStatus) {
    return existingTask;
  }

  // Determine if task is overdue (done tasks are not overdue)
  const isOverdue = newStatus === TaskStatus.DONE ? false : existingTask.dueDate < new Date();

  // 1. Update task in database
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      isOverdue,
    },
    include: {
      project: { select: { id: true, title: true, managerId: true } },
      assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  // 2. Format details string required by assessment:
  // "Ravi moved Task #12 from In Progress → In Review · 2 mins ago"
  const formattedDetails = `${user.name} moved Task "${existingTask.title}" from ${formatStatus(prevStatus)} → ${formatStatus(newStatus)}`;

  // 3. Store Activity Log in database
  const activity = await prisma.taskActivity.create({
    data: {
      taskId: existingTask.id,
      projectId: existingTask.projectId,
      userId: user.userId,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: prevStatus,
      newStatus,
      details: formattedDetails,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
      task: { select: { id: true, title: true } },
      project: { select: { id: true, title: true } },
    },
  });

  // 4. Trigger In-App Notification if task moved to IN_REVIEW -> notify Project Manager
  if (newStatus === TaskStatus.IN_REVIEW && existingTask.project.managerId !== user.userId) {
    const pmNotification = await prisma.notification.create({
      data: {
        userId: existingTask.project.managerId,
        taskId: existingTask.id,
        type: NotificationType.TASK_IN_REVIEW,
        title: 'Task Ready for Review',
        message: `${user.name} moved "${existingTask.title}" to In Review`,
      },
    });
    broadcastNotification(existingTask.project.managerId, pmNotification);
  }

  // 5. Broadcast real-time activity and task state update
  broadcastTaskActivity({
    projectId: existingTask.projectId,
    managerId: existingTask.project.managerId,
    assignedToId: existingTask.assignedToId,
    task: updatedTask,
    activity,
  });

  return updatedTask;
};

export const updateTask = async (
  taskId: string,
  data: Partial<CreateTaskInput>,
  user: JwtPayload
) => {
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, title: true, managerId: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  if (!existingTask) {
    throw new AppError('Task not found', 404, 'NOT_FOUND');
  }

  if (user.role === Role.DEVELOPER) {
    throw new AppError('Developers cannot edit task details, only status', 403, 'FORBIDDEN');
  }

  if (user.role === Role.PROJECT_MANAGER && existingTask.project.managerId !== user.userId) {
    throw new AppError('You can only edit tasks within projects you manage', 403, 'FORBIDDEN');
  }

  const updateData: Prisma.TaskUpdateInput = {};
  if (data.title) updateData.title = data.title;
  if (data.description) updateData.description = data.description;
  if (data.priority) updateData.priority = data.priority;
  if (data.dueDate) {
    const due = new Date(data.dueDate);
    updateData.dueDate = due;
    if (existingTask.status !== TaskStatus.DONE) {
      updateData.isOverdue = due < new Date();
    }
  }

  const assignmentChanged = data.assignedToId !== undefined && data.assignedToId !== existingTask.assignedToId;
  if (assignmentChanged) {
    updateData.assignedTo = data.assignedToId ? { connect: { id: data.assignedToId } } : { disconnect: true };
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
      project: { select: { id: true, title: true, managerId: true } },
      assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  // Handle assignment change activity & notification
  if (assignmentChanged && data.assignedToId) {
    const newAssignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    const activity = await prisma.taskActivity.create({
      data: {
        taskId: updatedTask.id,
        projectId: updatedTask.projectId,
        userId: user.userId,
        action: ActivityAction.ASSIGNMENT_CHANGE,
        details: `${user.name} assigned "${updatedTask.title}" to ${newAssignee?.name || 'Developer'}`,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, title: true } },
      },
    });

    const notif = await prisma.notification.create({
      data: {
        userId: data.assignedToId,
        taskId: updatedTask.id,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New Task Assigned',
        message: `You were assigned to "${updatedTask.title}" by ${user.name}`,
      },
    });
    broadcastNotification(data.assignedToId, notif);

    broadcastTaskActivity({
      projectId: updatedTask.projectId,
      managerId: updatedTask.project.managerId,
      assignedToId: updatedTask.assignedToId,
      task: updatedTask,
      activity,
    });
  }

  return updatedTask;
};
