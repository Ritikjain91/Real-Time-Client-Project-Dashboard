import React, { useState, useEffect } from 'react';
import { Briefcase, AlertCircle, Plus, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { PMMetrics, Task, TaskStatus } from '../../types';
import { TaskCard } from '../tasks/TaskCard';
import { TaskFilters, FilterState } from '../tasks/TaskFilters';
import { ActivityFeed } from '../activity/ActivityFeed';
import { TaskModal } from '../tasks/TaskModal';
import { CreateProjectModal } from '../projects/CreateProjectModal';

export const PMDashboard: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { latestTaskUpdate } = useSocket();

  const [metrics, setMetrics] = useState<PMMetrics | null>(null);
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
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.priority) queryParams.set('priority', filters.priority);
      if (filters.search) queryParams.set('search', filters.search);

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
      console.error('Error fetching PM dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, apiFetch]);

  useEffect(() => {
    if (!latestTaskUpdate) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === latestTaskUpdate.id ? { ...t, ...latestTaskUpdate } : t))
    );
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Project Manager Workspace
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Managing projects owned by {user?.name} · Isolated project access enforced
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setIsProjectModalOpen(true)} className="btn btn-secondary">
            <Plus size={16} />
            <span>New Project</span>
          </button>
          <button onClick={() => setIsTaskModalOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Assign Task</span>
          </button>
        </div>
      </div>

      {/* PM Stats Cards: Projects summary, tasks by priority, upcoming due dates */}
      <div className="stats-grid">
        {/* Managed Projects Summary */}
        <div className="stat-card">
          <div>
            <span className="stat-label">My Projects</span>
            <div className="stat-val" style={{ color: '#818cf8' }}>
              {metrics?.projectsCount ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Strict ownership scoping
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
            <Briefcase size={24} color="#6366f1" />
          </div>
        </div>

        {/* Due This Week */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Due This Week</span>
            <div className="stat-val" style={{ color: '#f59e0b' }}>
              {metrics?.upcomingTasksThisWeek.length ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#fcd34d' }}>
              Active weekly sprints
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px' }}>
            <Clock size={24} color="#f59e0b" />
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Overdue Tasks</span>
            <div className="stat-val" style={{ color: '#f87171' }}>
              {metrics?.overdueCount ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              Past delivery target
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px' }}>
            <AlertCircle size={24} color="#ef4444" />
          </div>
        </div>

        {/* Priority Breakdown Card */}
        <div className="stat-card">
          <div style={{ width: '100%' }}>
            <span className="stat-label">Tasks by Priority</span>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700 }}>CRIT</span>
                <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{metrics?.tasksByPriority.CRITICAL ?? 0}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#fb923c', fontWeight: 700 }}>HIGH</span>
                <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{metrics?.tasksByPriority.HIGH ?? 0}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>MED</span>
                <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{metrics?.tasksByPriority.MEDIUM ?? 0}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 700 }}>LOW</span>
                <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{metrics?.tasksByPriority.LOW ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Managed Projects Overview Cards */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#f8fafc' }}>
          Managed Project Health
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {metrics?.projects.map((p) => (
            <div key={p.id} className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.title}</h4>
                <span className="brand-badge" style={{ background: '#3b82f6' }}>{p.status}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
                {p.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>🏢 {p.client.company}</span>
                <span>📋 {p._count?.tasks || 0} tasks</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Filterable Task List & Live Scoped Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          <TaskFilters filters={filters} onChange={setFilters} />

          {tasks.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No tasks found matching your filter criteria.
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

        {/* Project Manager's Team Activity Feed */}
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
