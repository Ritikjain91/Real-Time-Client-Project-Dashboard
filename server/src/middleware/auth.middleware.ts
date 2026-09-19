import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/env';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { prisma } from '../lib/prisma';

/**
 * Verifies JWT Access Token from the Authorization header
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh your session.',
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid access token signature',
      },
    });
  }
};

/**
 * Enforces Role-Based Access Control (RBAC) at the API level
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking permissions',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Role '${req.user.role}' does not have sufficient permissions for this resource.`,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Enforces project ownership:
 * - Admin: Full access to any project.
 * - Project Manager: Can only access projects they created / manage.
 * - Developer: Cannot access project management endpoints directly.
 */
export const requireProjectOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  // Admin has global bypass
  if (req.user.role === Role.ADMIN) {
    return next();
  }

  const projectId = req.params.projectId || req.params.id || req.body.projectId;
  if (!projectId) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Project ID is required' },
    });
    return;
  }

  // Developers cannot manage projects
  if (req.user.role === Role.DEVELOPER) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Developers do not have permission to manage projects',
      },
    });
    return;
  }

  // Project Manager: verify they manage this specific project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { managerId: true },
  });

  if (!project) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    });
    return;
  }

  if (project.managerId !== req.user.userId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers can only manage their own projects',
      },
    });
    return;
  }

  next();
};

/**
 * Enforces task-level permissions:
 * - Admin: Full access.
 * - Project Manager: Can manage tasks in projects they manage.
 * - Developer: Can only view and update tasks assigned directly to them.
 */
export const requireTaskAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  if (req.user.role === Role.ADMIN) {
    return next();
  }

  const taskId = req.params.taskId || req.params.id;
  if (!taskId) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Task ID is required' },
    });
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: { managerId: true },
      },
    },
  });

  if (!task) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
    return;
  }

  // Project Manager check
  if (req.user.role === Role.PROJECT_MANAGER) {
    if (task.project.managerId !== req.user.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only access tasks within your own projects',
        },
      });
      return;
    }
    return next();
  }

  // Developer check: must be assigned to this task
  if (req.user.role === Role.DEVELOPER) {
    if (task.assignedToId !== req.user.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Developers can only access tasks assigned directly to them',
        },
      });
      return;
    }
    return next();
  }

  next();
};
