import React, { useState, useEffect } from 'react';
import { Activity, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { TaskActivity } from '../../types';

export const ActivityFeed: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { latestActivity, isConnected } = useSocket();
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, setTick] = useState<number>(0);

  // Re-render every 30s to update relative timestamps (e.g. "2 mins ago")
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch last 20 activity events from the database (offline catchup requirement)
  useEffect(() => {
    if (!user) return;
    const fetchCatchupActivity = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch('/api/activity?limit=20');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch activity feed catchup:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCatchupActivity();
  }, [user?.id, apiFetch]);

  // Real-time live activity ingestion over WebSocket
  useEffect(() => {
    if (!latestActivity) return;

    setActivities((prev) => {
      // Prevent duplicates
      if (prev.some((a) => a.id === latestActivity.id)) {
        return prev;
      }
      return [latestActivity, ...prev.slice(0, 29)];
    });
  }, [latestActivity]);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 45) return 'just now';
    const diffMins = Math.floor(diffSeconds / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="badge-role admin" style={{ fontSize: '0.65rem' }}>Admin</span>;
      case 'PROJECT_MANAGER':
        return <span className="badge-role pm" style={{ fontSize: '0.65rem' }}>PM</span>;
      case 'DEVELOPER':
        return <span className="badge-role dev" style={{ fontSize: '0.65rem' }}>Dev</span>;
      default:
        return null;
    }
  };

  return (
    <div className="activity-feed-panel">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="#6366f1" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Live Activity Feed</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Radio size={14} color={isConnected ? '#10b981' : '#f59e0b'} />
          <span style={{ fontSize: '0.75rem', color: isConnected ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
            {isConnected ? 'LIVE' : 'CONNECTING'}
          </span>
        </div>
      </div>

      <div className="activity-list">
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Fetching latest database events...
          </div>
        ) : activities.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No activity recorded yet. Change a task status to trigger live events!
          </div>
        ) : (
          activities.map((item) => (
            <div key={item.id} className="activity-card">
              <img
                src={
                  item.user?.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user?.name || 'User')}&background=6366f1&color=fff`
                }
                alt={item.user?.name}
                className="avatar-sm"
              />

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#f8fafc' }}>
                      {item.user?.name}
                    </span>
                    {getRoleBadge(item.user?.role)}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {item.details}
                </p>

                {item.project && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
                    📁 {item.project.title}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
