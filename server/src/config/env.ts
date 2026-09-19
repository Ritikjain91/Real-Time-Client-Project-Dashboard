import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://client-ten-delta-68.vercel.app' : 'http://localhost:5173'),
  
  databaseUrl: process.env.DATABASE_URL || 'postgresql://voyager:voyager@localhost:5432/dashboard_db?schema=public',
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'velozity_dashboard_access_secret_key_production_grade_jwt_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'velozity_dashboard_refresh_secret_key_production_grade_jwt_2026',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  cookie: {
    secret: process.env.COOKIE_SECRET || 'velozity_super_secret_cookie_signing_key_2026',
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  },
  
  cron: {
    overdueScanner: process.env.OVERDUE_SCANNER_CRON || '* * * * *',
  },
};
