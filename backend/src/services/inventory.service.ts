import { Prisma } from '@prisma/client';
import { InventoryStatus } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';
import { generateQRCode } from '../utils/qrcode.util';
import { isBatchOrDummySerial } from '../utils/export.util';
import { activityService } from './activity.service';

export interface InventoryFilters {
  search?: string;
  oemId?: string;
  categoryId?: string;
  locationId?: string;
  store?: string; // 'Delhi' | 'Bengaluru'
  isSerialized?: string; // 'true' | 'false'
  status?: InventoryStatus;
  warrantyExpiringDays?: number;
  page?: string;
  limit?: string;
}

export interface CreateInventoryDto {
  oemId: string;
  categoryId: string;
  productName: string;
  description?: string;
  model?: string;
  partId?: string;
  partCode?: string;
  serialNumber?: string;
  isSerialized?: boolean;
  quantity: number;
  unit?: string;
  store?: string;
  locationId?: string;
  rack?: string;
  bin?: string;
  condition?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  purchaseDate?: string;
  remarks?: string;
}

export class InventoryService {
  /**
   * Get all inventory items with filters and pagination
   */
  async getAll(filters: InventoryFilters, organizationId: string = 'BHEL') {
    const { page, limit, skip } = parsePagination(filters);
    const where: Prisma.InventoryItemWhereInput = {
      isDeleted: false,
      organizationId,
    };

    if (filters.search) {
      where.OR = [
        { spareId: { contains: filters.search } },
        { productName: { contains: filters.search } },
        { model: { contains: filters.search } },
        { partId: { contains: filters.search } },
        { partCode: { contains: filters.search } },
        { serialNumber: { contains: filters.search } },
        { oem: { name: { contains: filters.search } } },
        { category: { name: { contains: filters.search } } },
        { description: { contains: filters.search } },
      ];
    }

    if (filters.oemId) where.oemId = filters.oemId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.store) where.store = filters.store;
    if (filters.isSerialized !== undefined) {
      where.isSerialized = filters.isSerialized === 'true';
    }
    if (filters.status) {
      const statusUpper = String(filters.status).toUpperCase();
      if (statusUpper === 'LOW_STOCK') {
        where.availableQuantity = { lte: 5 };
      } else if (statusUpper === 'OUT_OF_STOCK') {
        where.availableQuantity = { equals: 0 };
      } else {
        where.status = filters.status;
      }
    }

    if (filters.warrantyExpiringDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(String(filters.warrantyExpiringDays)));
      where.warrantyEnd = { lte: futureDate };
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          oem: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, city: true } },
          createdBy: { select: { id: true, name: true } },
          comments: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return { items, pagination: buildPagination(page, limit, total) };
  }

  /**
   * Get single inventory item by ID
   */
  async getById(id: string) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, isDeleted: false },
      include: {
        oem: true,
        category: true,
        location: true,
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        comments: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        movements: {
          include: { performedBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        dispatches: {
          include: { site: true, createdBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        pickups: {
          include: { site: true, createdBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        reservations: {
          where: { status: 'ACTIVE' },
          include: { createdBy: { select: { name: true } } },
        },
      },
    });

    if (!item) throw new AppError(404, 'Inventory item not found');
    return item;
  }

  /**
   * Create new inventory item
   */
  async create(data: CreateInventoryDto, userId: string) {
    const count = await prisma.inventoryItem.count();
    const prefix = data.store === 'Bengaluru' ? 'PDS-BLR' : 'PDS-DEL';
    const spareId = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    let targetOemId = data.oemId;
    if (!targetOemId) {
      let firstOem = await prisma.oEM.findFirst({ where: { isActive: true } });
      if (!firstOem) {
        firstOem = await prisma.oEM.create({ data: { name: 'Generic OEM' } });
      }
      targetOemId = firstOem.id;
    }

    let targetCategoryId = data.categoryId;
    if (!targetCategoryId) {
      let firstCat = await prisma.category.findFirst({ where: { oemId: targetOemId, isActive: true } });
      if (!firstCat) {
        firstCat = await prisma.category.create({ data: { name: 'General', oemId: targetOemId } });
      }
      targetCategoryId = firstCat.id;
    }

    const qrCode = await generateQRCode(spareId);
    const isSerialized = !isBatchOrDummySerial(data.serialNumber);
    const quantity = isSerialized ? 1 : (data.quantity || 1);

    const item = await prisma.inventoryItem.create({
      data: {
        spareId,
        oemId: targetOemId,
        categoryId: targetCategoryId,
        productName: data.productName || 'Unnamed Spare Item',
        description: data.description,
        model: data.model,
        partId: data.partId,
        partCode: data.partCode,
        serialNumber: isSerialized ? data.serialNumber!.trim() : null,
        isSerialized,
        quantity,
        availableQuantity: quantity,
        unit: data.unit || 'PCS',
        store: data.store || 'Delhi',
        locationId: data.locationId || null,
        rack: data.rack,
        bin: data.bin,
        condition: data.condition || 'NEW',
        warrantyStart: data.warrantyStart ? new Date(data.warrantyStart) : null,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        remarks: data.remarks,
        qrCode,
        createdById: userId,
      },
      include: {
        oem: { select: { name: true } },
        category: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    // Log movement
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: 'IMPORT',
        quantity,
        previousStock: 0,
        newStock: quantity,
        performedById: userId,
        remarks: 'Manual item creation',
      },
    });

    // Activity log
    await activityService.logActivity({
      userId,
      module: 'Inventory',
      action: 'Add Part',
      entity: 'InventoryItem',
      entityId: item.id,
      entityLabel: `${item.partCode || item.spareId} - ${item.productName}`,
      partCode: item.partCode || undefined,
      serialNumber: item.serialNumber || undefined,
      newValue: `Quantity: ${quantity}, Store: ${item.store}, Status: ${item.status}`,
    });

    return item;
  }

  /**
   * Update inventory item
   */
  async update(id: string, data: Partial<CreateInventoryDto>, userId: string) {
    const existing = await prisma.inventoryItem.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new AppError(404, 'Inventory item not found');

    const isSerialized = data.serialNumber ? Boolean(data.serialNumber.trim()) : existing.isSerialized;

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...data,
        isSerialized,
        warrantyStart: data.warrantyStart ? new Date(data.warrantyStart) : undefined,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : undefined,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        updatedById: userId,
      },
      include: {
        oem: { select: { name: true } },
        category: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    // Compute field diffs for audit trail
    const changes: string[] = [];
    const inputStatus = (data as any).status;
    if (inputStatus && inputStatus !== existing.status) changes.push(`Status: ${existing.status} → ${inputStatus}`);
    if (data.quantity !== undefined && data.quantity !== existing.quantity) changes.push(`Quantity: ${existing.quantity} → ${data.quantity}`);
    if (data.serialNumber !== undefined && data.serialNumber !== existing.serialNumber) changes.push(`Serial No: ${existing.serialNumber || 'N/A'} → ${data.serialNumber || 'N/A'}`);
    if (data.store && data.store !== existing.store) changes.push(`Store: ${existing.store} → ${data.store}`);
    if (data.productName && data.productName !== existing.productName) changes.push(`Product Name: ${existing.productName} → ${data.productName}`);
    if (data.partCode && data.partCode !== existing.partCode) changes.push(`Part Code: ${existing.partCode || 'N/A'} → ${data.partCode}`);

    const primaryAction = changes.some(c => c.startsWith('Status'))
      ? 'Status Change'
      : changes.some(c => c.startsWith('Quantity'))
      ? 'Quantity Change'
      : changes.some(c => c.startsWith('Serial'))
      ? 'Serial Number Change'
      : 'Edit Part';

    await activityService.logActivity({
      userId,
      module: 'Inventory',
      action: primaryAction,
      entity: 'InventoryItem',
      entityId: id,
      entityLabel: `${updated.partCode || updated.spareId} - ${updated.productName}`,
      partCode: updated.partCode || undefined,
      serialNumber: updated.serialNumber || undefined,
      oldValue: changes.length > 0 ? changes.map(c => c.split(' → ')[0]).join(', ') : 'Previous Data',
      newValue: changes.length > 0 ? changes.join(' | ') : 'Updated Data',
    });

    return updated;
  }

  /**
   * Archive inventory item (Archive Instead of Delete)
   */
  async archiveItem(id: string, userId: string) {
    const item = await prisma.inventoryItem.findFirst({ where: { id, isDeleted: false } });
    if (!item) throw new AppError(404, 'Inventory item not found');

    if (item.status === 'DISPATCHED') {
      throw new AppError(400, 'Cannot archive a dispatched item');
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { isArchived: true, archivedAt: new Date(), archivedById: userId },
    });

    await activityService.logActivity({
      userId,
      module: 'Inventory',
      action: 'Archive Part',
      entity: 'InventoryItem',
      entityId: id,
      entityLabel: `${item.partCode || item.spareId} - ${item.productName}`,
      partCode: item.partCode || undefined,
      serialNumber: item.serialNumber || undefined,
      oldValue: 'Active Inventory',
      newValue: 'Archived Inventory',
    });

    return updated;
  }

  /**
   * Restore archived inventory item (Super Admin only)
   */
  async restoreArchivedItem(id: string, userId: string) {
    const item = await prisma.inventoryItem.findFirst({ where: { id } });
    if (!item) throw new AppError(404, 'Inventory item not found');

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { isArchived: false, archivedAt: null, archivedById: null, isDeleted: false },
    });

    await activityService.logActivity({
      userId,
      module: 'Inventory',
      action: 'Restore Archived Part',
      entity: 'InventoryItem',
      entityId: id,
      entityLabel: `${item.partCode || item.spareId} - ${item.productName}`,
      partCode: item.partCode || undefined,
      serialNumber: item.serialNumber || undefined,
      oldValue: 'Archived Inventory',
      newValue: 'Active Inventory',
    });

    return updated;
  }

  /**
   * Soft Delete inventory item
   */
  async delete(id: string, userId: string) {
    return this.archiveItem(id, userId);
  }

  /**
   * Comprehensive Dashboard Statistics with Part Code 50% Threshold Low Stock Rule
   */
  async getDashboardStats(organizationId: string = 'BHEL') {
    const orgWhere = { organizationId };
    const baseWhere: Prisma.InventoryItemWhereInput = { isDeleted: false, organizationId };
    const stockAnalysis = await this.calculatePartCodeLowStock(organizationId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalItems,
      totalSerialized,
      totalNonSerialized,
      oemCount,
      delhiStats,
      bengaluruStats,
      recentDispatches,
      recentPickups,
      recentActivities,
      oemDistributionRaw,
      monthlyDispatches,
      monthlyPickups,
      todaysActivitiesCount,
      totalActivitiesCount,
      todaysDispatchCount,
      todaysPickupCount,
      failedLoginAttemptsCount,
      recentInventoryUpdates,
    ] = await Promise.all([
      prisma.inventoryItem.count({ where: { isDeleted: false, organizationId } }),
      prisma.inventoryItem.count({ where: { isDeleted: false, isSerialized: true, organizationId } }),
      prisma.inventoryItem.count({ where: { isDeleted: false, isSerialized: false, organizationId } }),
      prisma.oEM.count({ where: { isActive: true } }),

      // Delhi store stats
      prisma.inventoryItem.aggregate({
        where: { isDeleted: false, store: 'Delhi', organizationId },
        _count: { id: true },
        _sum: { quantity: true, availableQuantity: true },
      }),

      // Bengaluru store stats
      prisma.inventoryItem.aggregate({
        where: { isDeleted: false, store: 'Bengaluru', organizationId },
        _count: { id: true },
        _sum: { quantity: true, availableQuantity: true },
      }),

      // Recent Dispatches
      prisma.dispatch.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { inventoryItem: true, site: true, createdBy: { select: { name: true } } },
      }),

      // Recent Pickups
      prisma.pickup.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { inventoryItem: true, site: true, createdBy: { select: { name: true } } },
      }),

      // Recent Activity
      prisma.activityLog.findMany({
        where: { organizationId },
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, role: true } } },
      }),

      // OEM distribution
      prisma.inventoryItem.groupBy({
        by: ['oemId'],
        where: { isDeleted: false, organizationId },
        _count: { id: true },
        _sum: { quantity: true },
      }),

      this.getMonthlyStats('dispatch', organizationId),
      this.getMonthlyStats('pickup', organizationId),

      // Phase 3 Activity Metrics
      prisma.activityLog.count({ where: { organizationId, createdAt: { gte: startOfToday } } }),
      prisma.activityLog.count({ where: { organizationId } }),
      prisma.dispatch.count({ where: { organizationId, createdAt: { gte: startOfToday } } }),
      prisma.pickup.count({ where: { organizationId, createdAt: { gte: startOfToday } } }),
      prisma.activityLog.count({ where: { organizationId, action: 'Failed Login', createdAt: { gte: startOfToday } } }),
      prisma.inventoryItem.findMany({
        where: { isDeleted: false, organizationId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { oem: true },
      }),
    ]);

    // Format OEM Distribution with names
    const oems = await prisma.oEM.findMany();
    const oemMap = new Map(oems.map((o) => [o.id, o.name]));
    const oemDistribution = oemDistributionRaw.map((item) => ({
      name: oemMap.get(item.oemId) || 'Unknown',
      count: item._count.id,
      totalQuantity: item._sum.quantity || 0,
    }));

    return {
      inventorySummary: {
        totalSpareParts: totalItems,
        totalSerializedParts: totalSerialized,
        totalNonSerializedParts: totalNonSerialized,
        totalOEMs: oemDistributionRaw.length,
        delhiTotalStock: delhiStats._sum.quantity || 0,
        bengaluruTotalStock: bengaluruStats._sum.quantity || 0,
        lowStockCount: stockAnalysis.lowStockCount,
        outOfStockCount: stockAnalysis.outOfStockCount,
        todaysActivitiesCount,
        totalActivitiesCount,
        todaysDispatchCount,
        todaysPickupCount,
        failedLoginAttemptsCount,
      },
      delhiStoreSummary: {
        totalItems: delhiStats._count.id,
        totalQuantity: delhiStats._sum.quantity || 0,
        availableQuantity: delhiStats._sum.availableQuantity || 0,
      },
      bengaluruStoreSummary: {
        totalItems: bengaluruStats._count.id,
        totalQuantity: bengaluruStats._sum.quantity || 0,
        availableQuantity: bengaluruStats._sum.availableQuantity || 0,
      },
      recentDispatches,
      recentPickups,
      recentActivities,
      recentInventoryUpdates,
      lowStockAlerts: stockAnalysis.lowStockAlerts,
      oemDistribution,
      monthlyDispatches,
      monthlyPickups,
    };
  }

  /**
   * Group active inventory items by Part Code and calculate Part Code level low stock alerts (<= 50% available stock).
   */
  async calculatePartCodeLowStock(organizationId: string = 'BHEL') {
    const activeItems = await prisma.inventoryItem.findMany({
      where: { isDeleted: false, organizationId },
      include: { oem: { select: { name: true } } },
    });

    const groups = new Map<string, {
      partCode: string;
      productName: string;
      oemName: string;
      totalQuantity: number;
      availableQuantity: number;
      sampleItem: any;
    }>();

    for (const item of activeItems) {
      const key = (item.partCode || item.productName || 'UNKNOWN').trim();
      const existing = groups.get(key);
      const qty = item.quantity || 1;
      const avail = item.availableQuantity ?? qty;

      if (!existing) {
        groups.set(key, {
          partCode: key,
          productName: item.productName,
          oemName: item.oem?.name || 'Generic',
          totalQuantity: qty,
          availableQuantity: avail,
          sampleItem: item,
        });
      } else {
        existing.totalQuantity += qty;
        existing.availableQuantity += avail;
      }
    }

    const lowStockAlerts: Array<{
      id?: string;
      partId?: string;
      partCode: string;
      partName?: string;
      productName: string;
      oemName: string;
      totalQuantity: number;
      availableQuantity: number;
      quantity?: number;
      reorderLevel?: number;
      minStock?: number;
      percentRemaining: number;
      isOutOfStock: boolean;
      spareId?: string;
      store?: string;
      location?: string;
    }> = [];

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const g of groups.values()) {
      if (g.totalQuantity > 0) {
        const percent = Math.round((g.availableQuantity / g.totalQuantity) * 100);

        if (g.availableQuantity === 0) {
          outOfStockCount++;
        }

        // Trigger Low Stock alert only when available stock falls to 50% or below of total quantity
        if (g.availableQuantity <= (g.totalQuantity * 0.5)) {
          lowStockCount++;
          lowStockAlerts.push({
            id: g.sampleItem?.id,
            partId: g.sampleItem?.partId || g.sampleItem?.spareId || g.partCode,
            partCode: g.partCode,
            partName: g.productName,
            productName: g.productName,
            oemName: g.oemName,
            totalQuantity: g.totalQuantity,
            quantity: g.availableQuantity,
            availableQuantity: g.availableQuantity,
            reorderLevel: (g.sampleItem as any)?.minStock || (g.sampleItem as any)?.min_stock || 5,
            minStock: (g.sampleItem as any)?.minStock || (g.sampleItem as any)?.min_stock || 5,
            percentRemaining: percent,
            isOutOfStock: g.availableQuantity === 0,
            spareId: g.sampleItem?.spareId,
            store: g.sampleItem?.store || 'Delhi',
            location: g.sampleItem?.store || g.sampleItem?.location?.name || 'Delhi',
          });
        }
      }
    }

    lowStockAlerts.sort((a, b) => a.percentRemaining - b.percentRemaining);

    return {
      lowStockCount,
      outOfStockCount,
      lowStockAlerts: lowStockAlerts,
      allLowStockGroups: lowStockAlerts,
    };
  }

  /**
   * Get stock alert detailed breakdown for low stock and out of stock items
   */
  async getStockAlerts(organizationId: string = 'BHEL') {
    const activeItems = await prisma.inventoryItem.findMany({
      where: { isDeleted: false, organizationId },
      include: { oem: { select: { name: true } }, location: { select: { name: true } } },
    });

    const stockItems = activeItems.map((item) => {
      const avail = item.availableQuantity ?? item.quantity;
      const minStock = (item as any).minStock || (item as any).min_stock || 5;
      return {
        id: item.id,
        partId: item.partId || item.spareId || item.partCode || 'N/A',
        partCode: item.partCode || item.spareId || 'N/A',
        partName: item.productName,
        productName: item.productName,
        quantity: avail,
        availableQuantity: avail,
        totalQuantity: item.quantity,
        reorderLevel: minStock,
        minStock,
        location: item.store || item.location?.name || 'Delhi',
        store: item.store || 'Delhi',
        oemName: item.oem?.name || 'Generic',
        isOutOfStock: avail === 0,
      };
    });

    const lowStockItems = stockItems.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel);
    const outOfStockItems = stockItems.filter((item) => item.quantity === 0);

    const partCodeAnalysis = await this.calculatePartCodeLowStock();

    return {
      summary: {
        lowStockCount: partCodeAnalysis.lowStockCount || lowStockItems.length,
        outOfStockCount: partCodeAnalysis.outOfStockCount || outOfStockItems.length,
      },
      lowStockItems: lowStockItems.length > 0 ? lowStockItems : partCodeAnalysis.allLowStockGroups,
      outOfStockItems,
      lowStockAlerts: partCodeAnalysis.allLowStockGroups,
    };
  }

  /**
   * Dynamic Real-time Low Stock Breakdown
   */
  async getDynamicLowStockDetails(organizationId: string = 'BHEL') {
    const allStock = await prisma.inventoryItem.findMany({
      where: { isDeleted: false, organizationId },
      include: {
        oem: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { availableQuantity: 'asc' },
    });

    const mappedStock = allStock.map((item) => {
      const avail = item.availableQuantity ?? item.quantity;
      const reorderLevel = (item as any).minStock || (item as any).min_stock || 5;
      return {
        id: item.id,
        partId: item.partId || item.spareId || item.partCode || 'N/A',
        partCode: item.partCode || item.spareId || 'N/A',
        partName: item.productName,
        productName: item.productName,
        category: item.category?.name || 'General',
        quantity: avail,
        availableQuantity: avail,
        totalQuantity: item.quantity,
        reorderLevel,
        minStock: reorderLevel,
        location: item.store || item.location?.name || 'Delhi',
        store: item.store || 'Delhi',
        oemName: item.oem?.name || 'Generic',
        unitPrice: 0,
        isOutOfStock: avail === 0,
      };
    });

    const outOfStockItems = mappedStock.filter((item) => item.quantity === 0);
    const lowStockItems = mappedStock.filter(
      (item) => item.quantity > 0 && item.quantity <= item.reorderLevel
    );

    const partCodeAnalysis = await this.calculatePartCodeLowStock(organizationId);

    const finalLowStockList = lowStockItems.length > 0 ? lowStockItems : partCodeAnalysis.allLowStockGroups;
    const finalLowStockCount = partCodeAnalysis.lowStockCount || lowStockItems.length;
    const finalOutOfStockCount = partCodeAnalysis.outOfStockCount || outOfStockItems.length;

    return {
      success: true,
      counts: {
        lowStock: finalLowStockCount,
        outOfStock: finalOutOfStockCount,
        totalWarning: finalLowStockCount + finalOutOfStockCount,
      },
      lowStockItems: finalLowStockList,
      outOfStockItems,
    };
  }

  private async getMonthlyStats(type: 'dispatch' | 'pickup', organizationId: string = 'BHEL') {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const count =
        type === 'dispatch'
          ? await prisma.dispatch.count({ where: { organizationId, createdAt: { gte: start, lte: end } } })
          : await prisma.pickup.count({ where: { organizationId, createdAt: { gte: start, lte: end } } });

      months.push({
        month: start.toLocaleString('default', { month: 'short' }),
        count,
      });
    }
    return months;
  }

  /**
   * Replace serial number in-place on an existing inventory item
   * (Matches by itemId OR OEM + Part Name / SKU, resets status to AVAILABLE, and syncs stock in-place)
   */
  async replaceSerialInPlace(
    params: {
      itemId?: string;
      productName?: string;
      partCode?: string;
      oemId?: string;
      serialNumber: string;
      originalSerialNumber?: string;
      remarks?: string;
    },
    userId: string
  ) {
    let item = null;

    if (params.itemId && params.itemId !== 'new') {
      item = await prisma.inventoryItem.findFirst({
        where: { id: params.itemId, isDeleted: false },
        include: { oem: true, category: true, location: true },
      });
    }

    if (!item && (params.productName || params.partCode)) {
      const whereClause: Prisma.InventoryItemWhereInput = {
        isDeleted: false,
        OR: [
          params.productName ? { productName: { equals: params.productName } } : {},
          params.partCode ? { partCode: { equals: params.partCode } } : {},
        ].filter((c) => Object.keys(c).length > 0),
      };

      if (params.oemId) {
        whereClause.oemId = params.oemId;
      }

      item = await prisma.inventoryItem.findFirst({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: { oem: true, category: true, location: true },
      });
    }

    if (!item) {
      throw new AppError(404, 'Target inventory item not found to replace serial number');
    }

    const faultySerial = params.originalSerialNumber || item.serialNumber || 'N/A';
    const newSerial = params.serialNumber.trim();
    const oemName = item.oem?.name || 'OEM';
    const previousStock = item.availableQuantity;
    const newStock = item.quantity > 0 ? item.quantity : 1;

    // Perform IN-PLACE UPDATE on existing item ID (NO insert / duplicate creation)
    const updated = await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        serialNumber: newSerial,
        isSerialized: true,
        status: 'AVAILABLE',
        availableQuantity: newStock,
        remarks: params.remarks || `Replacement serial number updated in-place: ${newSerial} (Original: ${faultySerial})`,
        updatedById: userId,
      },
      include: {
        oem: true,
        category: true,
        location: true,
      },
    });

    // Record detailed replacement audit movement log
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: 'RECEIPT',
        quantity: 1,
        previousStock,
        newStock,
        performedById: userId,
        remarks: `[REPLACEMENT HISTORY TRACE] OEM: ${oemName} | Part: ${item.productName} | Faulty/Orig SN: ${faultySerial} | New Replacement SN: ${newSerial} | Date: ${new Date().toISOString()} | Location: ${item.store || item.location?.name || 'Main Store'}`,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'REPLACEMENT_RECEIPT',
        entity: 'InventoryItem',
        entityId: item.id,
        entityLabel: `OEM Replacement Trace — OEM: ${oemName} | Part: ${item.productName} | Original SN: ${faultySerial} -> New SN: ${newSerial} | Store: ${item.store || 'Main Store'}`,
      },
    });

    return updated;
  }

  /**
   * Get location inventory items with search and filters
   */
  async getLocationInventories(
    filters: {
      search?: string;
      sublocation?: string;
      state?: string;
      buildingName?: string;
      roomId?: string;
      partId?: string;
      page?: string;
      limit?: string;
    },
    organizationId: string = 'BHEL'
  ) {
    const { page, limit, skip } = parsePagination(filters);
    if (organizationId !== 'BHEL') {
      return {
        items: [],
        pagination: buildPagination(page, limit, 0),
      };
    }
    const where: Prisma.LocationInventoryWhereInput = {};

    if (filters.state) where.state = { equals: filters.state };
    if (filters.buildingName) where.buildingName = { contains: filters.buildingName };
    if (filters.roomId) where.roomId = { contains: filters.roomId };
    if (filters.partId) where.partId = { contains: filters.partId };
    if (filters.sublocation) {
      where.OR = [
        { subUnit: { contains: filters.sublocation } },
        { unit: { contains: filters.sublocation } },
      ];
    }

    if (filters.search) {
      where.OR = [
        { partSerialNo: { contains: filters.search } },
        { partId: { contains: filters.search } },
        { roomId: { contains: filters.search } },
        { buildingName: { contains: filters.search } },
        { roomName: { contains: filters.search } },
        { oem: { contains: filters.search } },
        { state: { contains: filters.search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.locationInventory.count({ where }),
      prisma.locationInventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { unit: 'asc' },
          { subUnit: 'asc' },
          { state: 'asc' },
          { buildingName: 'asc' },
          { roomId: 'asc' },
          { partId: 'asc' },
        ],
      }),
    ]);

    const cleanedItems = items.map((item) => ({
      ...item,
      partSerialNo: isBatchOrDummySerial(item.partSerialNo) ? '' : item.partSerialNo.trim(),
    }));

    return {
      items: cleanedItems,
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Get replacement swap audit logs with search and pagination
   */
  async getReplacementAuditLogs(
    filters: {
      search?: string;
      state?: string;
      buildingName?: string;
      roomId?: string;
      page?: string;
      limit?: string;
    },
    organizationId: string = 'BHEL'
  ) {
    const { page, limit, skip } = parsePagination(filters);
    if (organizationId !== 'BHEL') {
      return {
        data: [],
        logs: [],
        pagination: buildPagination(page, limit, 0),
      };
    }
    const where: Prisma.ReplacementAuditLogWhereInput = {};

    if (filters.state) where.state = { equals: filters.state };
    if (filters.buildingName) where.buildingName = { contains: filters.buildingName };
    if (filters.roomId) where.roomId = { contains: filters.roomId };

    if (filters.search) {
      where.OR = [
        { oldFaultySerialNo: { contains: filters.search } },
        { newSpareSerialNo: { contains: filters.search } },
        { partId: { contains: filters.search } },
        { roomId: { contains: filters.search } },
        { buildingName: { contains: filters.search } },
        { state: { contains: filters.search } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.replacementAuditLog.count({ where }),
      prisma.replacementAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { swapDate: 'desc' },
        include: {
          dispatchedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const cleanedLogs = logs.map((log) => ({
      ...log,
      oldFaultySerialNo: isBatchOrDummySerial(log.oldFaultySerialNo) ? '' : log.oldFaultySerialNo.trim(),
      newSpareSerialNo: isBatchOrDummySerial(log.newSpareSerialNo) ? '' : log.newSpareSerialNo.trim(),
      dispatchedByName: log.dispatchedBy?.name || 'System Dispatcher',
    }));

    return {
      data: cleanedLogs,
      logs: cleanedLogs,
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Register replacement OEM parts under a new serial number with pre-filled OEM Name and Part Code
   */
  async createReplacementSerialItem(
    data: {
      oemId: string;
      categoryId?: string;
      productName: string;
      partCode?: string;
      partId?: string;
      serialNumber: string;
      store?: string;
      remarks?: string;
    },
    userId: string
  ) {
    if (!data.serialNumber || !data.serialNumber.trim()) {
      throw new AppError(400, 'Replacement serial number is required.');
    }
    const cleanSerial = data.serialNumber.trim();

    const existing = await prisma.inventoryItem.findUnique({
      where: { serialNumber: cleanSerial },
    });
    if (existing) {
      throw new AppError(400, `Item with serial number '${cleanSerial}' already exists.`);
    }

    let categoryId = data.categoryId;
    if (!categoryId) {
      const cat = await prisma.category.findFirst({
        where: { oemId: data.oemId },
      });
      if (cat) {
        categoryId = cat.id;
      } else {
        const newCat = await prisma.category.create({
          data: { name: 'General', oemId: data.oemId },
        });
        categoryId = newCat.id;
      }
    }

    const count = await prisma.inventoryItem.count();
    const store = data.store || 'Delhi';
    const prefix = store === 'Bengaluru' ? 'PDS-BLR' : 'PDS-DEL';
    const spareId = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const qrCode = await generateQRCode(spareId);

    const newItem = await prisma.inventoryItem.create({
      data: {
        spareId,
        oemId: data.oemId,
        categoryId,
        productName: data.productName.trim(),
        partCode: data.partCode ? data.partCode.trim() : null,
        partId: data.partId ? data.partId.trim() : null,
        serialNumber: cleanSerial,
        isSerialized: true,
        quantity: 1,
        availableQuantity: 1,
        store,
        status: 'AVAILABLE',
        remarks: data.remarks || 'OEM Replacement item registered under new serial number',
        qrCode,
        createdById: userId,
      },
      include: {
        oem: true,
        category: true,
        location: true,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: newItem.id,
        type: 'RECEIPT',
        quantity: 1,
        previousStock: 0,
        newStock: 1,
        performedById: userId,
        remarks: `OEM Replacement stock item registered under new serial number (${cleanSerial})`,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'InventoryItem',
        entityId: newItem.id,
        entityLabel: `OEM Replacement registered under new SN: ${cleanSerial} (${newItem.productName})`,
      },
    });

    return newItem;
  }

  /**
   * Re-stock / Replenish stock item back to AVAILABLE status
   * Supports both Serialized (New Serial Number) & Non-Serialized (Quantity / Pcs)
   */
  async replenishItem(
    id: string,
    data: { newSerialNo?: string; serialNo?: string; serialNumber?: string; quantity?: number; pcs?: number; addedPcs?: number; remarks?: string },
    userId: string
  ) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, isDeleted: false },
      include: { oem: true },
    });
    if (!item) throw new AppError(404, 'Stock item not found');

    const cleanSerial = (data.newSerialNo || data.serialNo || data.serialNumber || '').trim();
    if (cleanSerial && item.serialNumber && cleanSerial !== item.serialNumber) {
      const existing = await prisma.inventoryItem.findUnique({
        where: { serialNumber: cleanSerial },
      });
      if (existing && existing.id !== item.id) {
        throw new AppError(400, `Item with serial number '${cleanSerial}' already exists in stock.`);
      }
    }

    const pcsToAdd = Number(data.quantity || data.pcs || data.addedPcs || 1);

    if (item.isSerialized || cleanSerial) {
      // For Serialized Parts
      const updated = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          status: 'AVAILABLE',
          availableQuantity: 1,
          quantity: item.quantity > 0 ? item.quantity : 1,
          serialNumber: cleanSerial || item.serialNumber,
          isSerialized: true,
          reservedFor: null,
          dispatchedToRoomId: null,
          replacedFaultySerialNo: null,
          remarks: data.remarks || item.remarks || 'Re-stocked item set to AVAILABLE',
          updatedById: userId,
        },
      });

      await prisma.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: 'RESTOCK',
          quantity: 1,
          previousStock: item.availableQuantity,
          newStock: 1,
          performedById: userId,
          remarks: `Serialized part re-stocked to AVAILABLE ${cleanSerial ? '(New Serial No: ' + cleanSerial + ')' : ''}`,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId,
          action: 'RESTOCK',
          entity: 'InventoryItem',
          entityId: item.id,
          entityLabel: `Re-stocked serialized item ${item.productName} (${item.spareId})`,
        },
      });

      return updated;
    } else {
      // For Non-Serialized Parts
      const newTotalQty = item.quantity + pcsToAdd;
      const newAvail = item.availableQuantity + pcsToAdd;

      const updated = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          status: 'AVAILABLE',
          quantity: newTotalQty,
          availableQuantity: newAvail,
          reservedFor: null,
          dispatchedToRoomId: null,
          remarks: data.remarks || item.remarks,
          updatedById: userId,
        },
      });

      await prisma.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: 'RESTOCK',
          quantity: pcsToAdd,
          previousStock: item.availableQuantity,
          newStock: newAvail,
          performedById: userId,
          remarks: `Non-serialized part re-stocked by ${pcsToAdd} pcs (New Available Stock: ${newAvail})`,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId,
          action: 'RESTOCK',
          entity: 'InventoryItem',
          entityId: item.id,
          entityLabel: `Re-stocked ${pcsToAdd} pcs for ${item.productName} (${item.spareId})`,
        },
      });

      return updated;
    }
  }

  /** Alias for restockItem */
  async restockItem(
    id: string,
    data: { serialNo?: string; serialNumber?: string; quantity?: number; pcs?: number; addedPcs?: number; remarks?: string },
    userId: string
  ) {
    return this.replenishItem(id, data, userId);
  }

  /**
   * Fetch distinct site-to-room hierarchy data for cascading frontend dropdown selectors
   */
  async getLocationHierarchy(organizationId: string = 'BHEL') {
    if (organizationId !== 'BHEL') {
      return {
        units: [],
        sublocations: [],
        states: [],
        floors: [],
        buildingNames: [],
        roomNames: [],
        solutionTypes: [],
        locationClasses: [],
        roomIds: [],
        items: [],
      };
    }
    const items = await prisma.locationInventory.findMany({
      select: {
        unit: true,
        subUnit: true,
        state: true,
        floor: true,
        buildingName: true,
        roomName: true,
        solutionType: true,
        locationClass: true,
        roomId: true,
      },
    });

    const units = Array.from(new Set(items.map(i => i.unit).filter(Boolean)));
    const sublocations = Array.from(new Set(items.map(i => i.subUnit).filter(Boolean)));
    const states = Array.from(new Set(items.map(i => i.state).filter(Boolean)));
    const floors = Array.from(new Set(items.map(i => i.floor).filter(Boolean)));
    const buildingNames = Array.from(new Set(items.map(i => i.buildingName).filter(Boolean)));
    const roomNames = Array.from(new Set(items.map(i => i.roomName).filter(Boolean)));
    const solutionTypes = Array.from(new Set(items.map(i => i.solutionType).filter(Boolean)));
    const locationClasses = Array.from(new Set(items.map(i => i.locationClass).filter(Boolean)));
    const roomIds = Array.from(new Set(items.map(i => i.roomId).filter(Boolean)));

    return {
      units,
      sublocations,
      states,
      floors,
      buildingNames,
      roomNames,
      solutionTypes,
      locationClasses,
      roomIds,
      items,
    };
  }

  /**
   * Dynamically fetch installed items in a given Room ID
   */
  async getRoomInstalledItems(roomId: string) {
    const items = await prisma.locationInventory.findMany({
      where: { roomId: { equals: roomId } },
      orderBy: { installationDate: 'desc' },
    });
    return items;
  }
}

export const inventoryService = new InventoryService();
