import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { JwtPayload } from '../types';

export interface CreateProjectInput {
  title: string;
  description: string;
  clientId: string;
  managerId?: string;
  budget?: number;
  deadline?: string;
}

export const getProjectsForUser = async (user: JwtPayload) => {
  if (user.role === Role.ADMIN) {
    return prisma.project.findMany({
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
        manager: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
        tasks: {
          select: {
            id: true,
            status: true,
            priority: true,
            isOverdue: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (user.role === Role.PROJECT_MANAGER) {
    // PM sees ONLY their own projects
    return prisma.project.findMany({
      where: { managerId: user.userId },
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
        manager: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
        tasks: {
          select: {
            id: true,
            status: true,
            priority: true,
            isOverdue: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (user.role === Role.DEVELOPER) {
    // Developers only see projects where they have assigned tasks
    return prisma.project.findMany({
      where: {
        tasks: {
          some: { assignedToId: user.userId },
        },
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return [];
};

export const getProjectById = async (projectId: string, user: JwtPayload) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      manager: { select: { id: true, name: true, email: true, avatarUrl: true } },
      tasks: {
        include: {
          assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { dueDate: 'asc' },
      },
      activities: {
        include: {
          user: { select: { id: true, name: true, role: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!project) {
    throw new AppError('Project not found', 404, 'NOT_FOUND');
  }

  // Enforce access control
  if (user.role === Role.PROJECT_MANAGER && project.managerId !== user.userId) {
    throw new AppError('Access denied. You do not manage this project.', 403, 'FORBIDDEN');
  }

  if (user.role === Role.DEVELOPER) {
    const hasAssignedTask = project.tasks.some((t) => t.assignedToId === user.userId);
    if (!hasAssignedTask) {
      throw new AppError('Access denied. You have no assigned tasks in this project.', 403, 'FORBIDDEN');
    }
    // Developers only see their own tasks
    project.tasks = project.tasks.filter((t) => t.assignedToId === user.userId);
  }

  return project;
};

export const createProject = async (data: CreateProjectInput, user: JwtPayload) => {
  if (user.role !== Role.ADMIN && user.role !== Role.PROJECT_MANAGER) {
    throw new AppError('Only Admins and Project Managers can create projects', 403, 'FORBIDDEN');
  }

  // If PM is creating, they can only assign themselves as manager
  const managerId = user.role === Role.ADMIN ? (data.managerId || user.userId) : user.userId;

  // Validate client exists
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    throw new AppError('Specified client does not exist', 400, 'INVALID_CLIENT');
  }

  return prisma.project.create({
    data: {
      title: data.title,
      description: data.description,
      clientId: data.clientId,
      managerId,
      budget: data.budget,
      deadline: data.deadline ? new Date(data.deadline) : null,
    },
    include: {
      client: true,
      manager: { select: { id: true, name: true, email: true } },
    },
  });
};
