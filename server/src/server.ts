import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { config } from './config/env';
import { logger } from './lib/logger';
import { initSocketServer } from './sockets/socketServer';
import { startOverdueTaskScheduler } from './jobs/overdueScanner';
import { errorHandler } from './middleware/error.middleware';

import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import activityRoutes from './routes/activity.routes';
import notificationRoutes from './routes/notification.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app = express();
const httpServer = http.createServer(app);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body Parsing & Cookie Parsing
app.use(express.json());
app.use(cookieParser(config.cookie.secret));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global Error Handler
app.use(errorHandler);

// Initialize WebSocket Engine
initSocketServer(httpServer);

// Initialize Scheduled Background Jobs
startOverdueTaskScheduler();

// Start HTTP + WS Server
const server = httpServer.listen(config.port, () => {
  logger.info(`====================================================`);
  logger.info(`🚀 Server running on http://localhost:${config.port}`);
  logger.info(`📡 WebSocket engine initialized and ready`);
  logger.info(`⏰ Overdue task scanner active (${config.cron.overdueScanner})`);
  logger.info(`====================================================`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, httpServer };
