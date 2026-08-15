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
    const inputClean = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    logger.info(`Attempting login for: ${inputClean}`);

    // Automatically ensure default accounts exist in database if missing
    await this.ensureDefaultUsersExist();

    // Map common username handles to primary system emails
    const aliasMap: Record<string, string> = {
      admin: 'admin@proactivedata.in',
      superadmin: 'admin@proactivedata.in',
      inventory: 'inventory@proactivedata.in',
      engineer: 'engineer@proactivedata.in',
      viewer: 'viewer@proactivedata.in',
      rohit: 'rohit@pro.com',
    };
    const targetEmail = aliasMap[inputClean] || inputClean;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: targetEmail } },
          { email: { equals: inputClean } },
          { name: { equals: inputClean } },
        ],
      },
    });

    if (!user) {
      logger.warn(`Login failed: No user found for input ${inputClean}`);
      await prisma.activityLog.create({
        data: {
          userId: '00000000-0000-0000-0000-000000000000',
          userName: inputClean,
          userRole: 'UNKNOWN',
          module: 'Authentication',
          action: 'Failed Login',
          entity: 'User',
          entityLabel: inputClean,
          remarks: `Failed login attempt for non-existent or wrong account handle: ${inputClean}`,
          ipAddress,
        },
      }).catch(() => {});
      throw new AppError(401, 'Invalid email or password');
    }

    if (!user.isActive || user.status === 'SUSPENDED' || user.status === 'DISABLED') {
      logger.warn(`Login failed: User ${inputClean} is deactivated/suspended/disabled`);
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          module: 'Authentication',
          action: 'Failed Login',
          entity: 'User',
          entityId: user.id,
          entityLabel: user.email,
          remarks: `Failed login: User account status is ${user.status || 'Deactivated'}`,
          ipAddress,
        },
      }).catch(() => {});
      throw new AppError(401, `Your account is ${user.status || 'deactivated'}. Contact administrator.`);
    }

    let passwordMatch = await bcrypt.compare(cleanPassword, user.password);

    // Fallback support for demo passwords (Admin@123 / Admin@2026)
    if (!passwordMatch) {
      const demoPairs: Record<string, string> = {
        'admin@123': 'Admin@2026',
        'admin@2026': 'Admin@123',
        'inv@123': 'Inv@2026',
        'inv@2026': 'Inv@123',
        'eng@123': 'Eng@2026',
        'eng@2026': 'Eng@123',
        'view@123': 'View@2026',
        'view@2026': 'View@123',
      };
      const altPassword = demoPairs[cleanPassword.toLowerCase()];
      if (altPassword) {
        passwordMatch = await bcrypt.compare(altPassword, user.password);
      }
    }

    if (!passwordMatch) {
      logger.warn(`Login failed: Password mismatch for user ${inputClean}`);
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          module: 'Authentication',
          action: 'Failed Login',
          entity: 'User',
          entityId: user.id,
          entityLabel: user.email,
          remarks: 'Failed login attempt: Password mismatch',
          ipAddress,
        },
      }).catch(() => {});
      throw new AppError(401, 'Invalid email or password');
    }

    const userOrgId = (user as any).organizationId || 'BHEL';
    const tokenPayload = { userId: user.id, email: user.email, role: user.role as UserRole, organizationId: userOrgId };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years (lifetime access)
      },
    }).catch((err) => logger.warn('RefreshToken save notice:', err));

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        organizationId: userOrgId,
        module: 'Authentication',
        action: 'Login',
        entity: 'User',
        entityId: user.id,
        entityLabel: user.email,
        remarks: 'User logged in successfully',
        ipAddress,
      },
    }).catch(() => {});

    logger.info(`✅ Login successful: ${user.email} (${user.role})`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: userOrgId,
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
        expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years (lifetime access)
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

  /**
   * Helper: Guarantee default system accounts exist in database
   */
  private async ensureDefaultUsersExist() {
    try {
      const defaultAccounts = [
        { name: 'Super Admin', email: 'admin@proactivedata.in', pass: 'Admin@123', role: 'SUPER_ADMIN' },
        { name: 'Rohit Mourya', email: 'rohit@pro.com', pass: 'Rohit@123', role: 'SUPER_ADMIN' },
        { name: 'Inventory Admin', email: 'inventory@proactivedata.in', pass: 'Inv@123', role: 'INVENTORY_ADMIN' },
        { name: 'Field Engineer', email: 'engineer@proactivedata.in', pass: 'Eng@123', role: 'ENGINEER' },
        { name: 'Read Only User', email: 'viewer@proactivedata.in', pass: 'View@123', role: 'READ_ONLY' },
      ];

      for (const acc of defaultAccounts) {
        const existing = await prisma.user.findFirst({
          where: { email: { equals: acc.email } },
        });
        if (!existing) {
          const hashedPassword = await bcrypt.hash(acc.pass, 10);
          await prisma.user.create({
            data: {
              name: acc.name,
              email: acc.email,
              password: hashedPassword,
              role: acc.role as UserRole,
              isActive: true,
            },
          });
          logger.info(`Initialized missing system user: ${acc.email}`);
        }
      }
    } catch (err) {
      logger.warn('User initialization notice:', err);
    }
  }
}

export const authService = new AuthService();
