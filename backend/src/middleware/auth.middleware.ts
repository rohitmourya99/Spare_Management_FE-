import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/response.util';
import { logger } from '../config/logger';

import { UserRole } from '../types';

export { UserRole };

export interface JwtPayload {
  userId: string;
  name?: string;
  email: string;
  role: UserRole;
  status?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware: Verify JWT access token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ApiResponse.unauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch (jwtError) {
      if ((jwtError as Error).name === 'TokenExpiredError') {
        ApiResponse.unauthorized(res, 'Token expired');
      } else {
        ApiResponse.unauthorized(res, 'Invalid token');
      }
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, status: true, isActive: true },
    });

    if (!user || !user.isActive || user.status === 'SUSPENDED' || user.status === 'DISABLED') {
      ApiResponse.unauthorized(res, 'User account is deactivated, suspended, or disabled');
      return;
    }

    req.user = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      status: user.status,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    ApiResponse.serverError(res, 'Authentication error');
  }
};

/**
 * Middleware: Role-based authorization
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      ApiResponse.unauthorized(res, 'Not authenticated');
      return;
    }

    if (!roles.includes(req.user.role)) {
      ApiResponse.forbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
};

/**
 * Helper: Generate access token
 */
export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

/**
 * Helper: Generate refresh token
 */
export const generateRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
};

/**
 * Helper: Verify refresh token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
};
