import { Response } from 'express';
import { z } from 'zod';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { AuthenticatedRequest, TaskFilterParams } from '../types';
import {
  getTasksForUser,
  getTaskById,
  createTask,
  updateTaskStatus,
  updateTask,
} from '../services/task.service';

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    description: z.string().min(5, 'Description must be at least 5 characters'),
    projectId: z.string().uuid('Valid project ID is required'),
    assignedToId: z.string().uuid().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime({ message: 'Due date must be a valid ISO datetime' }),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(TaskStatus, {
      errorMap: () => ({ message: 'Status must be TODO, IN_PROGRESS, IN_REVIEW, or DONE' }),
    }),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().min(5).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime().optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  }),
});

export const getTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const query = req.query as Record<string, string>;

  const filters: TaskFilterParams = {
    status: query.status as TaskStatus | undefined,
    priority: query.priority as TaskPriority | undefined,
    projectId: query.projectId,
    assignedToId: query.assignedToId,
    dueDateFrom: query.dueDateFrom,
    dueDateTo: query.dueDateTo,
    search: query.search,
  };

  const tasks = await getTasksForUser(req.user!, filters);
  res.json({
    success: true,
    data: tasks,
  });
};

export const getTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const task = await getTaskById(id, req.user!);
  res.json({
    success: true,
    data: task,
  });
};

export const handleCreateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const task = await createTask(req.body, req.user!);
  res.status(201).json({
    success: true,
    data: task,
  });
};

export const handleUpdateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  const task = await updateTaskStatus(id, status, req.user!);
  res.json({
    success: true,
    data: task,
  });
};

export const handleUpdateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const task = await updateTask(id, req.body, req.user!);
  res.json({
    success: true,
    data: task,
  });
};
