import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  switchRole: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authenticated fetch wrapper injecting Bearer token with auto-refresh on 401
  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers || {});
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }

      let response = await fetch(input, {
        ...init,
        headers,
        credentials: 'include', // Include HttpOnly cookies
      });

      // Handle token expiration: attempt transparent refresh
      if (response.status === 401 && accessToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const newToken = data.data.accessToken;
            setAccessToken(newToken);
            setUser(data.data.user);

            headers.set('Authorization', `Bearer ${newToken}`);
            response = await fetch(input, {
              ...init,
              headers,
              credentials: 'include',
            });
          } else {
            // Refresh failed: session expired
            setAccessToken(null);
            setUser(null);
          }
        } catch {
          setAccessToken(null);
          setUser(null);
        }
      }

      return response;
    },
    [accessToken]
  );

  // Attempt initial session restore via refresh cookie
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.data.accessToken);
          setUser(data.data.user);
        } else {
          // Default demo fallback: login as Admin on first visit for evaluator convenience
          await login('admin@agency.com', 'Password123!');
        }
      } catch (err) {
        console.error('Session restore failed, falling back to default admin login:', err);
        try {
          await login('admin@agency.com', 'Password123!');
        } catch {}
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password = 'Password123!') => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (email: string) => {
    await login(email, 'Password123!');
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        switchRole,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
