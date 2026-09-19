import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import { JwtPayload } from '../types';
import { AppError } from '../middleware/error.middleware';

/**
 * Hashes a refresh token string using SHA-256 for secure database storage
 */
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Signs a short-lived access token
 */
export const generateAccessToken = (user: Pick<User, 'id' | 'email' | 'role' | 'name'>): string => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as any,
  });
};

/**
 * Creates and stores a new refresh token with an expiration date
 */
export const createRefreshToken = async (userId: string): Promise<string> => {
  // Generate random 40-byte cryptographically secure token
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);

  // 7 days expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return rawToken;
};

/**
 * Authenticates user credentials and returns tokens
 */
export const loginUser = async (email: string, plainPassword: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(plainPassword, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  };
};

/**
 * Rotates the refresh token and returns a fresh access token
 */
export const rotateRefreshToken = async (rawRefreshToken: string) => {
  if (!rawRefreshToken) {
    throw new AppError('Refresh token is required', 401, 'UNAUTHORIZED');
  }

  const tokenHash = hashToken(rawRefreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new AppError('Refresh token is expired or revoked', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Revoke old token (Refresh Token Rotation pattern)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Issue new pair
  const newAccessToken = generateAccessToken(storedToken.user);
  const newRefreshToken = await createRefreshToken(storedToken.user.id);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: storedToken.user.id,
      name: storedToken.user.name,
      email: storedToken.user.email,
      role: storedToken.user.role,
      avatarUrl: storedToken.user.avatarUrl,
    },
  };
};

/**
 * Revokes the current refresh token during logout
 */
export const revokeRefreshToken = async (rawRefreshToken: string): Promise<void> => {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};
