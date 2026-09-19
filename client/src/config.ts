// Production Render Backend URL
const PRODUCTION_API_URL = 'https://real-time-client-project-dashboard-c2o1.onrender.com';

// In development, API_BASE_URL defaults to '' to use the Vite local dev proxy (/api & /socket.io).
// In production on Vercel, it uses VITE_API_URL or defaults to the live Render backend URL.
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  (import.meta.env.PROD ? PRODUCTION_API_URL : '');
