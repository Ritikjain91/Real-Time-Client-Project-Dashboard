import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Briefcase, Code, Sparkles } from 'lucide-react';

const DEMO_USERS = [
  { name: 'Admin Eleanor', email: 'admin@agency.com', role: 'ADMIN', icon: Shield },
  { name: 'PM Sarah', email: 'sarah.pm@agency.com', role: 'PROJECT_MANAGER', icon: Briefcase },
  { name: 'PM Marcus', email: 'marcus.pm@agency.com', role: 'PROJECT_MANAGER', icon: Briefcase },
  { name: 'Dev Priya', email: 'priya.dev@agency.com', role: 'DEVELOPER', icon: Code },
  { name: 'Dev Alex', email: 'alex.dev@agency.com', role: 'DEVELOPER', icon: Code },
];

export const DemoBanner: React.FC = () => {
  const { user, switchRole, isLoading } = useAuth();

  return (
    <div className="demo-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Sparkles size={16} color="#c084fc" />
        <span style={{ fontWeight: 600, color: '#e0e7ff' }}>Evaluator Quick-Login:</span>
        <span style={{ color: '#94a3b8' }}>Test strict RBAC permissions in 1-click</span>
      </div>

      <div className="demo-pills">
        {DEMO_USERS.map((item) => {
          const Icon = item.icon;
          const isActive = user?.email === item.email;

          return (
            <button
              key={item.email}
              className={`demo-btn ${isActive ? 'active' : ''}`}
              disabled={isLoading}
              onClick={() => switchRole(item.email)}
              title={`Switch session to ${item.name} (${item.role})`}
            >
              <Icon size={13} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
