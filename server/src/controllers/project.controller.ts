import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { getProjectsForUser, getProjectById, createProject } from '../services/project.service';
import { prisma } from '../lib/prisma';

export const createProjectSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    description: z.string().min(5, 'Description must be at least 5 characters'),
    clientId: z.string().uuid('Valid client ID is required'),
    managerId: z.string().uuid().optional(),
    budget: z.number().positive().optional(),
    deadline: z.string().datetime().optional(),
  }),
});

export const getProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const projects = await getProjectsForUser(req.user!);
  res.json({
    success: true,
    data: projects,
  });
};

export const getProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const project = await getProjectById(id, req.user!);
  res.json({
    success: true,
    data: project,
  });
};

export const handleCreateProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const project = await createProject(req.body, req.user!);
  res.status(201).json({
    success: true,
    data: project,
  });
};

export const getClients = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({
    success: true,
    data: clients,
  });
};
