import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/env';
import { JwtPayload } from '../types';
import { logger } from '../lib/logger';
import { presenceTracker } from './presence';
import { prisma } from '../lib/prisma';

export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

let io: Server | null = null;

export const initSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Authentication Handshake Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token is missing'));
      }

      const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
      socket.user = decoded;
      next();
    } catch (err: any) {
      logger.warn(`Socket auth rejected: ${err.message}`);
      next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    logger.info(`WebSocket connected: User ${user.name} (${user.role}) - Socket ${socket.id}`);

    // Track presence
    presenceTracker.add(user.userId, socket.id);

    // Join direct user room for targeted notifications
    socket.join(`room:user:${user.userId}`);

    // Join role-specific broadcast rooms
    if (user.role === Role.ADMIN) {
      socket.join('room:admin');
    } else if (user.role === Role.PROJECT_MANAGER) {
      socket.join(`room:pm:${user.userId}`);
      
      // Auto-join projects managed by this PM
      try {
        const managedProjects = await prisma.project.findMany({
          where: { managerId: user.userId },
          select: { id: true },
        });
        managedProjects.forEach((p) => socket.join(`room:project:${p.id}`));
      } catch (err) {
        logger.error('Failed to bind PM to managed project rooms:', err);
      }
    } else if (user.role === Role.DEVELOPER) {
      socket.join(`room:dev:${user.userId}`);
    }

    // Broadcast presence update (Admin dashboard listens for live online count)
    emitPresenceUpdate();

    // Project view room subscription (allows user to observe a project if permitted)
    socket.on('project:join', async (projectId: string) => {
      if (!projectId) return;

      if (user.role === Role.ADMIN) {
        socket.join(`room:project:${projectId}`);
        return;
      }

      if (user.role === Role.PROJECT_MANAGER) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { managerId: true },
        });
        if (project && project.managerId === user.userId) {
          socket.join(`room:project:${projectId}`);
        }
        return;
      }

      if (user.role === Role.DEVELOPER) {
        const hasTask = await prisma.task.findFirst({
          where: { projectId, assignedToId: user.userId },
          select: { id: true },
        });
        if (hasTask) {
          socket.join(`room:project:${projectId}`);
        }
      }
    });

    socket.on('project:leave', (projectId: string) => {
      if (projectId) {
        socket.leave(`room:project:${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket disconnected: Socket ${socket.id}`);
      presenceTracker.remove(socket.id);
      emitPresenceUpdate();
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io server has not been initialized');
  }
  return io;
};

export const emitPresenceUpdate = () => {
  if (!io) return;
  const count = presenceTracker.getOnlineCount();
  const userIds = presenceTracker.getOnlineUserIds();

  // Broadcast to all clients for real-time presence indicators
  io.emit('presence:update', {
    onlineCount: count,
    onlineUserIds: userIds,
  });
};

/**
 * Real-time role-filtered activity and task change broadcaster
 */
export const broadcastTaskActivity = (params: {
  projectId: string;
  managerId: string;
  assignedToId?: string | null;
  task: any;
  activity: any;
}) => {
  if (!io) return;
  const { projectId, managerId, assignedToId, task, activity } = params;

  // 1. Admin receives all events across all projects
  io.to('room:admin').emit('activity:new', activity);
  io.to('room:admin').emit('task:updated', task);

  // 2. Project Manager receives events for projects they manage
  io.to(`room:pm:${managerId}`).emit('activity:new', activity);
  io.to(`room:pm:${managerId}`).emit('task:updated', task);

  // 3. Project-specific viewers room
  io.to(`room:project:${projectId}`).emit('activity:new', activity);
  io.to(`room:project:${projectId}`).emit('task:updated', task);

  // 4. Assigned Developer receives activity only for their own task
  if (assignedToId) {
    io.to(`room:dev:${assignedToId}`).emit('activity:new', activity);
    io.to(`room:dev:${assignedToId}`).emit('task:updated', task);
  }
};

/**
 * Targeted real-time notification broadcaster
 */
export const broadcastNotification = (userId: string, notification: any) => {
  if (!io) return;
  io.to(`room:user:${userId}`).emit('notification:new', notification);
};
