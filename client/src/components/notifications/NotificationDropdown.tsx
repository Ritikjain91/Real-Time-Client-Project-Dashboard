import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Notification } from '../../types';

export const NotificationDropdown: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { latestNotification } = useSocket();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications from database
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const res = await apiFetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.data.notifications || []);
          setUnreadCount(data.data.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    };

    fetchNotifications();
  }, [user?.id, apiFetch]);

  // Real-time notification updates over WebSocket
  useEffect(() => {
    if (!latestNotification) return;

    setNotifications((prev) => [latestNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  }, [latestNotification]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount(data.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await apiFetch('/api/notifications/read-all', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="notif-wrapper" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{ marginLeft: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                  ({unreadCount} unread)
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  cursor: 'pointer',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notif-item ${!notif.isRead ? 'unread' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.825rem', color: '#f8fafc' }}>
                      {notif.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {formatTime(notif.createdAt)}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.775rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                    {notif.message}
                  </p>

                  {!notif.isRead && (
                    <div style={{ alignSelf: 'flex-end', marginTop: '0.25rem' }}>
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: 'none',
                          color: '#818cf8',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        <Check size={12} />
                        Mark read
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
