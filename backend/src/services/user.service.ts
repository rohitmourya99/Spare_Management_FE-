import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types';
import { parsePagination, buildPagination } from '../utils/response.util';

export class UserService {
  async getAll(filters: { search?: string; role?: UserRole; page?: string; limit?: string }) {
    const { page, limit, skip } = parsePagination(filters);
    const where: any = {};

    if (filters.role) where.role = filters.role;
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
          phone: true, isActive: true, lastLoginAt: true, createdAt: true,
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
        phone: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    return user;
  }

  async create(data: { name: string; email: string; password: string; role: UserRole; phone?: string }) {
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
      },
      select: {
        id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true,
      },
    });
    return user;
  }

  async update(id: string, data: { name?: string; role?: UserRole; phone?: string; isActive?: boolean }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');

    return await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true,
      },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    // Revoke all sessions
    await prisma.refreshToken.updateMany({ where: { userId: id }, data: { isRevoked: true } });
  }
}

export const userService = new UserService();
