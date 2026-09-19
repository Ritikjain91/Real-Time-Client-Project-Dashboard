import { Request } from 'express';
import { Role, TaskStatus, TaskPriority } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TaskFilterParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assignedToId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
}
