import React, { useState, useEffect } from 'react';
import { Layers, CheckCircle2, AlertTriangle, Users, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { AdminMetrics, Task, TaskStatus } from '../../types';
import { TaskCard } from '../tasks/TaskCard';
import { TaskFilters, FilterState } from '../tasks/TaskFilters';
import { ActivityFeed } from '../activity/ActivityFeed';
import { TaskModal } from '../tasks/TaskModal';
import { CreateProjectModal } from '../projects/CreateProjectModal';

export const AdminDashboard: React.FC = () => {
  const { apiFetch } = useAuth();
  const { onlineCount, latestTaskUpdate } = useSocket();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Initialize filters from URL query parameters (shareable URL requirement)
  const [filters, setFilters] = useState<FilterState>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('status') || '',
      priority: params.get('priority') || '',
      dueDateRange: params.get('dueDateRange') || '',
      search: params.get('search') || '',
    };
  });

  const fetchData = async () => {
    try {
      // Build query string for API
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.priority) queryParams.set('priority', filters.priority);
      if (filters.search) queryParams.set('search', filters.search);

      // Handle dueDateRange shortcuts
      const now = new Date();
      if (filters.dueDateRange === 'overdue') {
        queryParams.set('dueDateTo', now.toISOString());
      } else if (filters.dueDateRange === 'today') {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        queryParams.set('dueDateTo', endOfDay.toISOString());
      } else if (filters.dueDateRange === 'week') {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + 7);
        queryParams.set('dueDateTo', endOfWeek.toISOString());
      }

      const [metricsRes, tasksRes] = await Promise.all([
        apiFetch('/api/dashboard/metrics'),
        apiFetch(`/api/tasks?${queryParams.toString()}`),
      ]);

      if (metricsRes.ok) {
        const m = await metricsRes.json();
        setMetrics(m.data);
      }

      if (tasksRes.ok) {
        const t = await tasksRes.json();
        setTasks(t.data || []);
      }
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, apiFetch]);

  // Handle live task state updates over WebSocket
  useEffect(() => {
    if (!latestTaskUpdate) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === latestTaskUpdate.id ? { ...t, ...latestTaskUpdate } : t))
    );
    // Refresh metrics on task update
    apiFetch('/api/dashboard/metrics')
      .then((res) => res.json())
      .then((m) => {
        if (m.success) setMetrics(m.data);
      });
  }, [latestTaskUpdate]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data.data : t)));
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Executive Dashboard
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Global agency visibility, real-time presence tracking, and cross-project status
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setIsProjectModalOpen(true)} className="btn btn-secondary">
            <Plus size={16} />
            <span>New Project</span>
          </button>
          <button onClick={() => setIsTaskModalOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="stats-grid">
        {/* Total Projects */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Total Projects</span>
            <div className="stat-val" style={{ color: '#818cf8' }}>
              {metrics?.totalProjects ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Active client engagements</span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
            <Layers size={24} color="#6366f1" />
          </div>
        </div>

        {/* Total Tasks */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Total Tasks</span>
            <div className="stat-val" style={{ color: '#38bdf8' }}>
              {metrics?.totalTasks ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {metrics?.tasksByStatus.DONE ?? 0} completed
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '10px' }}>
            <CheckCircle2 size={24} color="#0ea5e9" />
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="stat-card" style={{ borderColor: metrics && metrics.overdueCount > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
          <div>
            <span className="stat-label">Overdue Tasks</span>
            <div className="stat-val" style={{ color: '#f87171' }}>
              {metrics?.overdueCount ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
              Flagged by node-cron scheduler
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px' }}>
            <AlertTriangle size={24} color="#ef4444" />
          </div>
        </div>

        {/* Active Online Users */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Active Users Online</span>
            <div className="stat-val" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{onlineCount}</span>
              <span className="presence-dot" />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
              Live WebSocket Presence
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px' }}>
            <Users size={24} color="#10b981" />
          </div>
        </div>
      </div>

      {/* Task Status Breakdown Strip */}
      {metrics && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            background: 'var(--bg-surface)',
            padding: '1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>To Do</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#cbd5e1' }}>
              {metrics.tasksByStatus.TODO}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>In Progress</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa' }}>
              {metrics.tasksByStatus.IN_PROGRESS}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>In Review</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fcd34d' }}>
              {metrics.tasksByStatus.IN_REVIEW}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Done</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
              {metrics.tasksByStatus.DONE}
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Filterable Task Grid (Left 65%) + Live Activity Feed (Right 35%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          {/* Shareable Filter Bar */}
          <TaskFilters filters={filters} onChange={setFilters} />

          {/* Tasks Grid */}
          {tasks.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No tasks match the active filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* Global Live Activity Feed */}
        <ActivityFeed />
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSuccess={fetchData}
      />
      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};
