import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  UserRole,
} from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

export class AuthService {
  /**
   * Login with email and password
   */
  async login(email: string, password: string, ipAddress?: string) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    logger.info(`Attempting login for email: ${cleanEmail}`);

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      logger.warn(`Login failed: No user found with email ${cleanEmail}`);
      throw new AppError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      logger.warn(`Login failed: User ${cleanEmail} is deactivated`);
      throw new AppError(401, 'Your account has been deactivated. Contact administrator.');
    }

    const passwordMatch = await bcrypt.compare(cleanPassword, user.password);
    if (!passwordMatch) {
      logger.warn(`Login failed: Password mismatch for user ${cleanEmail}`);
      throw new AppError(401, 'Invalid email or password');
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role as UserRole };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        entityLabel: user.email,
        ipAddress,
      },
    });

    logger.info(`✅ Login successful: ${user.email} (${user.role})`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new AppError(401, 'Refresh token is invalid or expired');
    }

    if (!storedToken.user.isActive) {
      throw new AppError(401, 'Account deactivated');
    }

    const tokenPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role as UserRole,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Rotate refresh token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken: string, userId: string, ipAddress?: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, userId },
      data: { isRevoked: true },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        entity: 'User',
        entityId: userId,
        ipAddress,
      },
    });
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) throw new AppError(404, 'User not found');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new AppError(400, 'Current password is incorrect');

    if (newPassword.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGE',
        entity: 'User',
        entityId: userId,
      },
    });
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) throw new AppError(404, 'User not found');
    return user;
  }
}

export const authService = new AuthService();
