import { Request, Response, CookieOptions } from 'express';
import { z } from 'zod';
import { loginUser, rotateRefreshToken, revokeRefreshToken } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';

const REFRESH_COOKIE_NAME = 'jwt_refresh';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  const result = await loginUser(email, password);

  // Set HttpOnly refresh token cookie
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'NO_REFRESH_TOKEN',
        message: 'No refresh token provided in HttpOnly cookie',
      },
    });
    return;
  }

  const result = await rotateRefreshToken(token);

  // Overwrite cookie with the newly rotated refresh token
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    await revokeRefreshToken(token);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    path: '/api/auth',
  });

  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
    return;
  }

  res.json({
    success: true,
    data: user,
  });
};

export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const roleFilter = req.query.role as string | undefined;

  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter as any } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: users,
  });
};
