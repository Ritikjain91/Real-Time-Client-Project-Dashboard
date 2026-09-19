import React, { useState } from 'react';
import { Calendar, AlertTriangle, ArrowRight } from 'lucide-react';
import { Task, TaskStatus } from '../../types';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onEdit?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange }) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const handleStatusClick = async (newStatus: TaskStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Status progression action buttons
  const renderQuickAction = () => {
    if (task.status === 'TODO') {
      return (
        <button
          className="btn btn-primary btn-sm"
          disabled={isUpdating}
          onClick={() => handleStatusClick('IN_PROGRESS')}
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
        >
          <span>Start Work</span>
          <ArrowRight size={12} />
        </button>
      );
    }
    if (task.status === 'IN_PROGRESS') {
      return (
        <button
          className="btn btn-secondary btn-sm"
          disabled={isUpdating}
          onClick={() => handleStatusClick('IN_REVIEW')}
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.65rem',
            borderColor: '#f59e0b',
            color: '#fcd34d',
          }}
        >
          <span>Submit Review</span>
          <ArrowRight size={12} />
        </button>
      );
    }
    if (task.status === 'IN_REVIEW') {
      return (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={isUpdating}
            onClick={() => handleStatusClick('DONE')}
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.65rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
          >
            <span>Approve & Done</span>
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={isUpdating}
            onClick={() => handleStatusClick('IN_PROGRESS')}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            title="Request changes / Send back to In Progress"
          >
            Revise
          </button>
        </div>
      );
    }
    if (task.status === 'DONE') {
      return (
        <button
          className="btn btn-secondary btn-sm"
          disabled={isUpdating}
          onClick={() => handleStatusClick('TODO')}
          style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', color: '#94a3b8' }}
        >
          Reopen
        </button>
      );
    }
    return null;
  };

  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header Badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span className={`badge-priority ${task.priority}`}>{task.priority}</span>
          <span className={`badge-status ${task.status}`}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor:
                  task.status === 'DONE'
                    ? '#10b981'
                    : task.status === 'IN_REVIEW'
                    ? '#f59e0b'
                    : task.status === 'IN_PROGRESS'
                    ? '#3b82f6'
                    : '#94a3b8',
              }}
            />
            {task.status.replace('_', ' ')}
          </span>
          {task.isOverdue && task.status !== 'DONE' && (
            <span className="badge-overdue">
              <AlertTriangle size={12} />
              OVERDUE
            </span>
          )}
        </div>

        {/* Project Tag */}
        {task.project && (
          <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>
            {task.project.title.split(' ')[0]}...
          </span>
        )}
      </div>

      {/* Title & Description */}
      <div>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>
          {task.title}
        </h4>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.description}
        </p>
      </div>

      {/* Footer Info & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Due Date */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.75rem',
              color: task.isOverdue && task.status !== 'DONE' ? '#f87171' : '#94a3b8',
              fontWeight: task.isOverdue ? 700 : 500,
            }}
          >
            <Calendar size={13} />
            <span>{formatDate(task.dueDate)}</span>
          </div>

          {/* Assigned Developer */}
          {task.assignedTo && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title={`Assigned to ${task.assignedTo.name}`}
            >
              <img
                src={task.assignedTo.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignedTo.name)}&background=6366f1&color=fff`}
                alt={task.assignedTo.name}
                style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                {task.assignedTo.name.split(' ')[0]}
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Button */}
        <div>{renderQuickAction()}</div>
      </div>
    </div>
  );
};
