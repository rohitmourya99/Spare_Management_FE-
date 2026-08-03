import { Prisma } from '@prisma/client';
import { InventoryStatus } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';
import { generateQRCode } from '../utils/qrcode.util';

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
  async getAll(filters: InventoryFilters) {
    const { page, limit, skip } = parsePagination(filters);
    const where: Prisma.InventoryItemWhereInput = {
      isDeleted: false,
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
    if (filters.status) where.status = filters.status;

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
    const isSerialized = Boolean(data.serialNumber && data.serialNumber.trim() !== '');
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
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'InventoryItem',
        entityId: item.id,
        entityLabel: `${item.spareId} - ${item.productName}`,
        newValue: JSON.stringify(item),
      },
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

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'InventoryItem',
        entityId: id,
        entityLabel: `${updated.spareId} - ${updated.productName}`,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated),
      },
    });

    return updated;
  }

  /**
   * Soft Delete inventory item (Data Security requirement)
   */
  async delete(id: string, userId: string) {
    const item = await prisma.inventoryItem.findFirst({ where: { id, isDeleted: false } });
    if (!item) throw new AppError(404, 'Inventory item not found');

    if (item.status === 'DISPATCHED') {
      throw new AppError(400, 'Cannot delete a dispatched item');
    }

    await prisma.inventoryItem.update({
      where: { id },
      data: { isDeleted: true, updatedById: userId },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'InventoryItem',
        entityId: id,
        entityLabel: `${item.spareId} - ${item.productName}`,
        oldValue: JSON.stringify(item),
      },
    });
  }

  /**
   * Comprehensive Dashboard Statistics
   */
  async getDashboardStats() {
    const [
      totalItems,
      totalSerialized,
      totalNonSerialized,
      oemCount,
      delhiStats,
      bengaluruStats,
      lowStockCount,
      outOfStockCount,
      recentDispatches,
      recentPickups,
      recentActivities,
      lowStockAlerts,
      oemDistributionRaw,
      monthlyDispatches,
      monthlyPickups,
    ] = await Promise.all([
      prisma.inventoryItem.count({ where: { isDeleted: false } }),
      prisma.inventoryItem.count({ where: { isDeleted: false, isSerialized: true } }),
      prisma.inventoryItem.count({ where: { isDeleted: false, isSerialized: false } }),
      prisma.oEM.count({ where: { isActive: true } }),

      // Delhi store stats
      prisma.inventoryItem.aggregate({
        where: { isDeleted: false, store: 'Delhi' },
        _count: { id: true },
        _sum: { quantity: true, availableQuantity: true },
      }),

      // Bengaluru store stats
      prisma.inventoryItem.aggregate({
        where: { isDeleted: false, store: 'Bengaluru' },
        _count: { id: true },
        _sum: { quantity: true, availableQuantity: true },
      }),

      // Stock alerts
      prisma.inventoryItem.count({
        where: { isDeleted: false, availableQuantity: { gt: 0, lte: 2 } },
      }),
      prisma.inventoryItem.count({
        where: { isDeleted: false, availableQuantity: 0 },
      }),

      // Recent Dispatches
      prisma.dispatch.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { inventoryItem: true, site: true, createdBy: { select: { name: true } } },
      }),

      // Recent Pickups
      prisma.pickup.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { inventoryItem: true, site: true, createdBy: { select: { name: true } } },
      }),

      // Recent Activity
      prisma.activityLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, role: true } } },
      }),

      // Low Stock Alert List
      prisma.inventoryItem.findMany({
        where: { isDeleted: false, availableQuantity: { lte: 2 } },
        include: { oem: true },
        take: 5,
      }),

      // OEM distribution
      prisma.inventoryItem.groupBy({
        by: ['oemId'],
        where: { isDeleted: false },
        _count: { id: true },
        _sum: { quantity: true },
      }),

      this.getMonthlyStats('dispatch'),
      this.getMonthlyStats('pickup'),
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
        totalOEMs: oemCount,
        delhiTotalStock: delhiStats._sum.quantity || 0,
        bengaluruTotalStock: bengaluruStats._sum.quantity || 0,
        lowStockCount,
        outOfStockCount,
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
      lowStockAlerts,
      oemDistribution,
      monthlyDispatches,
      monthlyPickups,
    };
  }

  private async getMonthlyStats(type: 'dispatch' | 'pickup') {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const count =
        type === 'dispatch'
          ? await prisma.dispatch.count({ where: { createdAt: { gte: start, lte: end } } })
          : await prisma.pickup.count({ where: { createdAt: { gte: start, lte: end } } });

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
  async getLocationInventories(filters: {
    search?: string;
    sublocation?: string;
    state?: string;
    buildingName?: string;
    roomId?: string;
    partId?: string;
    page?: string;
    limit?: string;
  }) {
    const { page, limit, skip } = parsePagination(filters);
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

    return {
      items,
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Get replacement swap audit logs with search and pagination
   */
  async getReplacementAuditLogs(filters: {
    search?: string;
    state?: string;
    buildingName?: string;
    roomId?: string;
    page?: string;
    limit?: string;
  }) {
    const { page, limit, skip } = parsePagination(filters);
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

    return {
      logs,
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
  async getLocationHierarchy() {
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
      where: { roomId: { equals: roomId, mode: 'insensitive' } },
      orderBy: { installationDate: 'desc' },
    });
    return items;
  }
}

export const inventoryService = new InventoryService();
