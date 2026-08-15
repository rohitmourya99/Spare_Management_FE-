import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types';
import { parsePagination, buildPagination } from '../utils/response.util';
import { activityService } from './activity.service';

export class UserService {
  async getAll(filters: { search?: string; role?: UserRole; status?: string; page?: string; limit?: string }, requestingUserRole?: string, organizationId: string = 'BHEL') {
    const { page, limit, skip } = parsePagination(filters);
    const where: any = {};
    if (requestingUserRole !== 'SUPER_ADMIN') {
      where.organizationId = organizationId;
    }

    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, role: true,
          phone: true, status: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, pagination: buildPagination(page, limit, total) };
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, status: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    return user;
  }

  async create(
    data: { name: string; email: string; password: string; role: UserRole; phone?: string; status?: string },
    performedBy?: { userId: string; name?: string; role?: string }
  ) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new AppError(409, 'Email already registered');

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashed,
        role: data.role,
        phone: data.phone,
        status: data.status || 'ACTIVE',
        isActive: (data.status || 'ACTIVE') === 'ACTIVE',
      },
      select: {
        id: true, name: true, email: true, role: true, phone: true, status: true, isActive: true, createdAt: true,
      },
    });

    if (performedBy) {
      await activityService.logActivity({
        userId: performedBy.userId,
        userName: performedBy.name,
        userRole: performedBy.role,
        module: 'User Management',
        action: 'User Created',
        entity: 'User',
        entityId: user.id,
        entityLabel: `${user.name} (${user.email})`,
        newValue: `Role: ${user.role}, Status: ${user.status}`,
      });
    }

    return user;
  }

  async update(
    id: string,
    data: { name?: string; role?: UserRole; phone?: string; status?: string; isActive?: boolean },
    performedBy?: { userId: string; name?: string; role?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');

    const oldValues = `Name: ${user.name}, Role: ${user.role}, Status: ${user.status || 'ACTIVE'}`;

    const updateData: any = { ...data };
    if (data.status) {
      updateData.isActive = data.status === 'ACTIVE';
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, name: true, email: true, role: true, phone: true, status: true, isActive: true, createdAt: true,
      },
    });

    const newValues = `Name: ${updated.name}, Role: ${updated.role}, Status: ${updated.status || 'ACTIVE'}`;

    if (performedBy) {
      let action = 'User Edited';
      let oldVal = oldValues;
      let newVal = newValues;

      if (data.role && data.role !== user.role) {
        action = 'Role Changed';
        oldVal = `Role: ${user.role}`;
        newVal = `Role: ${updated.role}`;
      } else if (data.status && data.status !== user.status) {
        action = data.status === 'ACTIVE' ? 'User Activated' : data.status === 'SUSPENDED' ? 'User Suspended' : 'Status Changed';
        oldVal = `Status: ${user.status || 'ACTIVE'}`;
        newVal = `Status: ${updated.status || 'ACTIVE'}`;
      }

      await activityService.logActivity({
        userId: performedBy.userId,
        userName: performedBy.name,
        userRole: performedBy.role,
        module: 'User Management',
        action,
        entity: 'User',
        entityId: updated.id,
        entityLabel: `${updated.name} (${updated.email})`,
        oldValue: oldVal,
        newValue: newVal,
      });
    }

    return updated;
  }

  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
    performedBy?: { userId: string; name?: string; role?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');

    const oldStatus = user.status || (user.isActive ? 'ACTIVE' : 'DISABLED');
    const isActive = status === 'ACTIVE';

    const updated = await prisma.user.update({
      where: { id },
      data: { status, isActive },
      select: {
        id: true, name: true, email: true, role: true, phone: true, status: true, isActive: true, createdAt: true,
      },
    });

    // Revoke refresh tokens if suspended or disabled
    if (!isActive) {
      await prisma.refreshToken.updateMany({ where: { userId: id }, data: { isRevoked: true } });
    }

    if (performedBy) {
      const action = status === 'ACTIVE' ? 'User Activated' : status === 'SUSPENDED' ? 'User Suspended' : 'User Disabled';
      await activityService.logActivity({
        userId: performedBy.userId,
        userName: performedBy.name,
        userRole: performedBy.role,
        module: 'User Management',
        action,
        entity: 'User',
        entityId: updated.id,
        entityLabel: `${updated.name} (${updated.email})`,
        oldValue: `Status: ${oldStatus}`,
        newValue: `Status: ${status}`,
      });
    }

    return updated;
  }

  async resetPassword(
    id: string,
    newPassword: string,
    performedBy?: { userId: string; name?: string; role?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashed } });

    // Revoke all sessions
    await prisma.refreshToken.updateMany({ where: { userId: id }, data: { isRevoked: true } });

    if (performedBy) {
      await activityService.logActivity({
        userId: performedBy.userId,
        userName: performedBy.name,
        userRole: performedBy.role,
        module: 'User Management',
        action: 'Password Reset',
        entity: 'User',
        entityId: user.id,
        entityLabel: `${user.name} (${user.email})`,
        remarks: 'Password reset and sessions revoked',
      });
    }
  }
}

export const userService = new UserService();
