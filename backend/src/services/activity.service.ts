import { prisma } from '../config/database';
import { parsePagination, buildPagination } from '../utils/response.util';
import { UserRole } from '../types';

export interface CreateActivityLogDTO {
  userId: string;
  userName?: string;
  userRole?: string;
  module: 'Inventory' | 'Dispatch' | 'Pickup' | 'Reports' | 'Import' | 'Site Master' | 'User Management' | 'Authentication' | string;
  action: string;
  entity?: string;
  entityId?: string;
  entityLabel?: string;
  partCode?: string;
  serialNumber?: string;
  siteName?: string;
  oldValue?: string;
  newValue?: string;
  remarks?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class ActivityService {
  /**
   * Automatically Log Activity
   */
  async logActivity(data: CreateActivityLogDTO) {
    try {
      // Lookup user name/role if omitted
      let uName = data.userName;
      let uRole = data.userRole;
      if ((!uName || !uRole) && data.userId) {
        const u = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { name: true, role: true },
        });
        if (u) {
          uName = uName || u.name;
          uRole = uRole || u.role;
        }
      }

      return await prisma.activityLog.create({
        data: {
          userId: data.userId,
          userName: uName || 'System User',
          userRole: uRole || 'SYSTEM',
          module: data.module,
          action: data.action,
          entity: data.entity || data.module,
          entityId: data.entityId,
          entityLabel: data.entityLabel,
          partCode: data.partCode,
          serialNumber: data.serialNumber,
          siteName: data.siteName,
          oldValue: data.oldValue,
          newValue: data.newValue,
          remarks: data.remarks,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (e) {
      console.error('Failed to log activity:', e);
      return null;
    }
  }

  /**
   * Fetch Activity Logs with RBAC Visibility and Filters
   */
  async getAll(
    filters: {
      userId?: string;
      role?: string;
      module?: string;
      action?: string;
      partCode?: string;
      serialNumber?: string;
      site?: string;
      search?: string;
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
    },
    currentUser: { userId: string; role: UserRole }
  ) {
    const { page, limit, skip } = parsePagination(filters);
    const where: any = {};

    // RBAC Access Control Scoping
    if (currentUser.role === UserRole.ENGINEER) {
      // Field Engineer sees only their own activities
      where.userId = currentUser.userId;
    } else if (currentUser.role === UserRole.INVENTORY_ADMIN) {
      // Inventory Admin sees Inventory, Dispatch, Pickup, Import, Reports logs
      where.module = { in: ['Inventory', 'Dispatch', 'Pickup', 'Import', 'Reports', 'Site Master'] };
    }

    // Explicit Filter Overrides
    if (filters.userId) where.userId = filters.userId;
    if (filters.role) where.userRole = filters.role;
    if (filters.module) where.module = filters.module;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.partCode) where.partCode = { contains: filters.partCode };
    if (filters.serialNumber) where.serialNumber = { contains: filters.serialNumber };
    if (filters.site) where.siteName = { contains: filters.site };

    if (filters.search) {
      where.OR = [
        { userName: { contains: filters.search } },
        { action: { contains: filters.search } },
        { module: { contains: filters.search } },
        { entityLabel: { contains: filters.search } },
        { partCode: { contains: filters.search } },
        { serialNumber: { contains: filters.search } },
        { siteName: { contains: filters.search } },
      ];
    }

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

  /**
   * Export Activity Logs for Excel / PDF / CSV
   */
  async exportLogs(
    filters: any,
    currentUser: { userId: string; role: UserRole }
  ) {
    const result = await this.getAll({ ...filters, page: '1', limit: '5000' }, currentUser);
    return result.logs.map((log) => ({
      'Date & Time': new Date(log.createdAt).toLocaleString('en-IN'),
      'User Name': log.userName || log.user?.name || 'System',
      'User Role': log.userRole || log.user?.role || 'N/A',
      Module: log.module,
      Action: log.action,
      'Item / Entity': log.entityLabel || log.entity || '-',
      'Part Code': log.partCode || '-',
      'Serial Number': log.serialNumber || '-',
      Site: log.siteName || '-',
      'Old Value': log.oldValue || '-',
      'New Value': log.newValue || '-',
      Remarks: log.remarks || '-',
    }));
  }
}

export const activityService = new ActivityService();
