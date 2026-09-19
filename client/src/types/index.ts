export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget?: number;
  deadline?: string;
  clientId: string;
  client: Client;
  managerId: string;
  manager: User;
  _count?: {
    tasks: number;
  };
  tasks?: Array<{
    id: string;
    status: TaskStatus;
    priority: TaskPriority;
    isOverdue: boolean;
  }>;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  project: {
    id: string;
    title: string;
    managerId: string;
  };
  assignedToId?: string | null;
  assignedTo?: User | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  task?: {
    id: string;
    title: string;
  };
  projectId: string;
  project?: {
    id: string;
    title: string;
  };
  userId: string;
  user: {
    id: string;
    name: string;
    role: Role;
    avatarUrl?: string;
  };
  action: string;
  previousStatus?: TaskStatus | null;
  newStatus?: TaskStatus | null;
  details: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  taskId?: string | null;
  task?: {
    id: string;
    title: string;
  } | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminMetrics {
  role: 'ADMIN';
  totalProjects: number;
  totalTasks: number;
  tasksByStatus: {
    TODO: number;
    IN_PROGRESS: number;
    IN_REVIEW: number;
    DONE: number;
  };
  overdueCount: number;
  activeUsersOnline: number;
}

export interface PMMetrics {
  role: 'PROJECT_MANAGER';
  projectsCount: number;
  projects: Project[];
  tasksByPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  upcomingTasksThisWeek: Task[];
  overdueCount: number;
}

export interface DevMetrics {
  role: 'DEVELOPER';
  totalAssigned: number;
  pendingCount: number;
  completedCount: number;
  overdueCount: number;
  tasks: Task[];
}

export type DashboardMetrics = AdminMetrics | PMMetrics | DevMetrics;
