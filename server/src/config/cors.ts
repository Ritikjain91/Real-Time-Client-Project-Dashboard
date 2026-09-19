import { config } from './env';

export const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow non-browser requests (Postman, health checks)
  
  const cleanOrigin = origin.replace(/\/$/, '');
  const configuredClientUrl = config.clientUrl.replace(/\/$/, '');

  if (
    cleanOrigin === configuredClientUrl ||
    cleanOrigin === 'http://localhost:5173' ||
    cleanOrigin === 'http://127.0.0.1:5173' ||
    cleanOrigin.endsWith('.vercel.app') ||
    cleanOrigin.endsWith('.onrender.com') ||
    config.env !== 'production'
  ) {
    return true;
  }

  return false;
};

export const corsOriginDelegate = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean | string) => void
) => {
  if (isAllowedOrigin(origin)) {
    callback(null, origin || true);
  } else {
    callback(new Error(`CORS blocked for origin: ${origin}`));
  }
};
