import { prisma } from '../config/database';
import { parsePagination, buildPagination } from '../utils/response.util';
import { ActivityAction } from '../types';

export class ActivityService {
  async getAll(filters: {
    userId?: string;
    entity?: string;
    action?: ActivityAction;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
  }) {
    const { page, limit, skip } = parsePagination(filters);
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.entity) where.entity = { contains: filters.entity };
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { logs, pagination: buildPagination(page, limit, total) };
  }
}

export const activityService = new ActivityService();
