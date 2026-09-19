import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { DemoBanner } from './components/layout/DemoBanner';
import { Navbar } from './components/layout/Navbar';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { PMDashboard } from './components/dashboard/PMDashboard';
import { DevDashboard } from './components/dashboard/DevDashboard';

const DashboardRouter: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading && !user) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '1rem',
          color: '#94a3b8',
        }}
      >
        <div className="presence-dot" style={{ width: '16px', height: '16px' }} />
        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Authenticating Velozity WorkOS session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#f87171' }}>
        Session could not be established. Please click any role in the Quick Switch bar above.
      </div>
    );
  }

  return (
    <main className="main-content">
      {user.role === 'ADMIN' && <AdminDashboard />}
      {user.role === 'PROJECT_MANAGER' && <PMDashboard />}
      {user.role === 'DEVELOPER' && <DevDashboard />}
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="app-container">
          <DemoBanner />
          <Navbar />
          <DashboardRouter />
        </div>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
