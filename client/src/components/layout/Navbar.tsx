import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { Layers, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { onlineCount, isConnected } = useSocket();

  const getRoleClass = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'badge-role admin';
      case 'PROJECT_MANAGER':
        return 'badge-role pm';
      case 'DEVELOPER':
        return 'badge-role dev';
      default:
        return 'badge-role';
    }
  };

  const formatRoleName = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Admin';
      case 'PROJECT_MANAGER':
        return 'Project Manager';
      case 'DEVELOPER':
        return 'Developer';
      default:
        return role;
    }
  };

  return (
    <header className="navbar">
      <div className="nav-brand">
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <Layers size={20} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>VELOZITY</span>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>WorkOS</span>
        </div>
        <span className="brand-badge">Real-Time</span>
      </div>

      <div className="nav-actions">
        {/* Real-Time Presence Indicator */}
        <div className="presence-pill" title={isConnected ? 'Connected to WebSocket Engine' : 'Reconnecting...'}>
          <div className="presence-dot" style={{ backgroundColor: isConnected ? '#10b981' : '#f59e0b' }} />
          <span>{onlineCount} {onlineCount === 1 ? 'User' : 'Users'} Online</span>
        </div>

        {/* In-App Notifications Dropdown */}
        <NotificationDropdown />

        {/* User Identity & Role */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`}
              alt={user.name}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: '2px solid rgba(99, 102, 241, 0.5)',
                objectFit: 'cover',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                {user.name}
              </span>
              <div>
                <span className={getRoleClass(user.role)}>
                  {formatRoleName(user.role)}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="btn btn-secondary btn-sm"
              title="Logout session"
              style={{ padding: '0.4rem 0.6rem', marginLeft: '0.25rem' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
