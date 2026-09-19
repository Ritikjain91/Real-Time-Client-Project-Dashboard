import React, { useState, useEffect } from 'react';
import { Code, CheckCircle2, Clock, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { DevMetrics, Task, TaskStatus } from '../../types';
import { TaskCard } from '../tasks/TaskCard';
import { TaskFilters, FilterState } from '../tasks/TaskFilters';
import { ActivityFeed } from '../activity/ActivityFeed';

export const DevDashboard: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { latestTaskUpdate } = useSocket();

  const [metrics, setMetrics] = useState<DevMetrics | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

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
      console.error('Error fetching developer dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, apiFetch]);

  useEffect(() => {
    if (!latestTaskUpdate) return;
    // Developers only receive their own task updates via room:dev:userId
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
            My Development Queue
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Developer workspace for {user?.name} · Tasks sorted by priority then deadline
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
          <ArrowUpDown size={14} />
          <span>Priority Sorted: Critical → High → Medium → Low</span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="stats-grid">
        {/* Total Assigned */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Assigned to Me</span>
            <div className="stat-val" style={{ color: '#818cf8' }}>
              {metrics?.totalAssigned ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Individual workload
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
            <Code size={24} color="#6366f1" />
          </div>
        </div>

        {/* Pending In Progress */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Pending Completion</span>
            <div className="stat-val" style={{ color: '#38bdf8' }}>
              {metrics?.pendingCount ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Active tasks in queue
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '10px' }}>
            <Clock size={24} color="#0ea5e9" />
          </div>
        </div>

        {/* Completed */}
        <div className="stat-card">
          <div>
            <span className="stat-label">Delivered & Done</span>
            <div className="stat-val" style={{ color: '#34d399' }}>
              {metrics?.completedCount ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
              Successfully shipped
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px' }}>
            <CheckCircle2 size={24} color="#10b981" />
          </div>
        </div>

        {/* Overdue */}
        <div className="stat-card" style={{ borderColor: metrics && metrics.overdueCount > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
          <div>
            <span className="stat-label">Overdue</span>
            <div className="stat-val" style={{ color: '#f87171' }}>
              {metrics?.overdueCount ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              Requires attention
            </span>
          </div>
          <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px' }}>
            <AlertTriangle size={24} color="#ef4444" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Developer's Assigned Tasks + Developer's Scoped Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          <TaskFilters filters={filters} onChange={setFilters} />

          {tasks.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No tasks currently assigned matching your filters.
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

        {/* Developer Activity Feed (only on their assigned tasks) */}
        <ActivityFeed />
      </div>
    </div>
  );
};
