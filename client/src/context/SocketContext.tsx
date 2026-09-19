import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { TaskActivity, Task, Notification } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineCount: number;
  onlineUserIds: string[];
  latestActivity: TaskActivity | null;
  latestTaskUpdate: Task | null;
  latestNotification: Notification | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accessToken, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [latestActivity, setLatestActivity] = useState<TaskActivity | null>(null);
  const [latestTaskUpdate, setLatestTaskUpdate] = useState<Task | null>(null);
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (!accessToken || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Connect to WebSocket server with JWT auth handshake
    const newSocket = io({
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time presence listener
    newSocket.on('presence:update', (data: { onlineCount: number; onlineUserIds: string[] }) => {
      setOnlineCount(data.onlineCount);
      setOnlineUserIds(data.onlineUserIds || []);
    });

    // Live Activity Stream listener
    newSocket.on('activity:new', (activity: TaskActivity) => {
      setLatestActivity(activity);
    });

    // Real-time Task state listener
    newSocket.on('task:updated', (task: Task) => {
      setLatestTaskUpdate(task);
    });

    // Real-time In-App Notification listener
    newSocket.on('notification:new', (notification: Notification) => {
      setLatestNotification(notification);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken, user?.id]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineCount,
        onlineUserIds,
        latestActivity,
        latestTaskUpdate,
        latestNotification,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
