import { Prisma } from '@prisma/client';
import { DispatchStatus } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';

export interface CreateDispatchDto {
  inventoryItemId: string;
  siteId: string;
  quantity: number;
  courierName?: string;
  trackingNo?: string;
  dispatchDate?: string;
  expectedDelivery?: string;
  engineerName?: string;
  remarks?: string;
}

export class DispatchService {
  async getAll(filters: {
    search?: string;
    status?: DispatchStatus;
    siteId?: string;
    page?: string;
    limit?: string;
  }) {
    const { page, limit, skip } = parsePagination(filters);
    const where: Prisma.DispatchWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.search) {
      where.OR = [
        { dispatchNo: { contains: filters.search } },
        { trackingNo: { contains: filters.search } },
        { site: { siteName: { contains: filters.search } } },
        { inventoryItem: { productName: { contains: filters.search } } },
      ];
    }

    const [dispatches, total] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          inventoryItem: { select: { spareId: true, productName: true, model: true, serialNumber: true, isSerialized: true, oem: { select: { name: true } } } },
          site: { select: { siteName: true, locationClass: true, unitDivision: true, city: true, state: true, pin: true, contactPerson: true, phone: true, email: true, fullAddress: true } },
          createdBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dispatch.count({ where }),
    ]);

    // Map originalSerialNumber from remarks or inventoryItem for immutability
    const mappedDispatches = dispatches.map((d) => {
      let originalSerial = d.inventoryItem?.serialNumber || null;
      if (d.remarks && d.remarks.includes('[Dispatched SN:')) {
        const match = d.remarks.match(/\[Dispatched SN:\s*([^\]]+)\]/);
        if (match && match[1]) {
          originalSerial = match[1].trim();
        }
      }
      return {
        ...d,
        originalSerialNumber: originalSerial,
      };
    });

    return { dispatches: mappedDispatches, pagination: buildPagination(page, limit, total) };
  }

  async getById(id: string) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        inventoryItem: { include: { oem: true, category: true, location: true } },
        site: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        fileUploads: true,
      },
    });
    if (!dispatch) throw new AppError(404, 'Dispatch not found');

    let originalSerial = dispatch.inventoryItem?.serialNumber || null;
    if (dispatch.remarks && dispatch.remarks.includes('[Dispatched SN:')) {
      const match = dispatch.remarks.match(/\[Dispatched SN:\s*([^\]]+)\]/);
      if (match && match[1]) {
        originalSerial = match[1].trim();
      }
    }

    return {
      ...dispatch,
      originalSerialNumber: originalSerial,
    };
  }

  async create(data: CreateDispatchDto, userId: string) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: data.inventoryItemId, isDeleted: false },
    });
    if (!item) throw new AppError(404, 'Inventory item not found');

    const qtyToDispatch = data.quantity || 1;
    if (item.availableQuantity < qtyToDispatch) {
      throw new AppError(
        400,
        `Insufficient available stock. Requested: ${qtyToDispatch}, Available: ${item.availableQuantity}`
      );
    }

    const count = await prisma.dispatch.count();
    const dispatchNo = `DS-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const newAvail = item.availableQuantity - qtyToDispatch;
    const newStatus = newAvail <= 0 ? 'RESERVED' : item.status;

    // Capture exact live real-time timestamp (current date and time of dispatch)
    const now = new Date();
    let dispatchTimestamp = now;
    if (data.dispatchDate) {
      const selected = new Date(data.dispatchDate);
      if (!isNaN(selected.getTime())) {
        selected.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        dispatchTimestamp = selected;
      }
    }

    // Lock original serial number permanently in remarks
    const originalSerial = item.serialNumber || 'Bulk';
    const lockedRemarks = `[Dispatched SN: ${originalSerial}]${data.remarks ? ' ' + data.remarks : ''}`;

    // Transaction to create dispatch & update inventory stock & record movement
    const [dispatch] = await prisma.$transaction([
      prisma.dispatch.create({
        data: {
          dispatchNo,
          inventoryItemId: data.inventoryItemId,
          siteId: data.siteId,
          quantity: qtyToDispatch,
          courierName: data.courierName,
          trackingNo: data.trackingNo,
          dispatchDate: dispatchTimestamp,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          remarks: lockedRemarks,
          status: DispatchStatus.DISPATCHED,
          createdById: userId,
          approvedById: userId,
          approvedAt: now,
        },
        include: {
          inventoryItem: { select: { spareId: true, productName: true, serialNumber: true } },
          site: { select: { siteName: true } },
        },
      }),
      prisma.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: {
          availableQuantity: newAvail,
          status: newStatus,
          updatedById: userId,
        },
      }),
      prisma.inventoryMovement.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: 'DISPATCH',
          quantity: qtyToDispatch,
          previousStock: item.availableQuantity,
          newStock: newAvail,
          referenceId: dispatchNo,
          performedById: userId,
          remarks: `Dispatched to site (Dispatch #${dispatchNo})`,
        },
      }),
    ]);

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DISPATCH',
        entity: 'Dispatch',
        entityId: dispatch.id,
        entityLabel: `${dispatch.dispatchNo} (${item.productName})`,
      },
    });

    return dispatch;
  }

  async approve(id: string, userId: string) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: { inventoryItem: true },
    });
    if (!dispatch) throw new AppError(404, 'Dispatch not found');
    return dispatch;
  }

  async markDispatched(id: string, data: { trackingNo?: string; courierName?: string; dispatchDate?: string }, userId: string) {
    const dispatch = await prisma.dispatch.findUnique({ where: { id } });
    if (!dispatch) throw new AppError(404, 'Dispatch not found');

    const updated = await prisma.dispatch.update({
      where: { id },
      data: {
        status: DispatchStatus.DISPATCHED,
        trackingNo: data.trackingNo,
        courierName: data.courierName,
        dispatchDate: data.dispatchDate ? new Date(data.dispatchDate) : new Date(),
      },
    });

    return updated;
  }

  async cancel(id: string, userId: string) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: { inventoryItem: true },
    });
    if (!dispatch) throw new AppError(404, 'Dispatch not found');
    if (dispatch.status === 'CANCELLED') {
      throw new AppError(400, 'Dispatch already cancelled');
    }

    // Restore available quantity
    const newAvail = dispatch.inventoryItem.availableQuantity + dispatch.quantity;

    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: dispatch.inventoryItemId },
        data: { availableQuantity: newAvail, status: 'AVAILABLE' },
      }),
      prisma.dispatch.update({ where: { id }, data: { status: DispatchStatus.CANCELLED } }),
      prisma.inventoryMovement.create({
        data: {
          inventoryItemId: dispatch.inventoryItemId,
          type: 'ADJUSTMENT',
          quantity: dispatch.quantity,
          previousStock: dispatch.inventoryItem.availableQuantity,
          newStock: newAvail,
          referenceId: dispatch.dispatchNo,
          performedById: userId,
          remarks: `Dispatch #${dispatch.dispatchNo} cancelled - stock restored`,
        },
      }),
    ]);

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Dispatch',
        entityId: id,
        entityLabel: `${dispatch.dispatchNo} CANCELLED`,
      },
    });
  }

  /**
   * Performs automated Faulty Serial Number Replacement & Swap Logic
   */
  async swapFaultySerial(
    dto: {
      spareItemId: string;
      locationInventoryId?: string;
      faultySerialNo: string;
      targetState: string;
      buildingName: string;
      roomId: string;
      roomName?: string;
      remarks?: string;
    },
    userId: string
  ) {
    const spareItem = await prisma.inventoryItem.findUnique({
      where: { id: dto.spareItemId },
      include: { oem: true },
    });

    if (!spareItem) {
      throw new AppError(404, 'Spare stock item not found.');
    }

    if (spareItem.availableQuantity <= 0) {
      throw new AppError(400, 'Selected spare item is not available in stock.');
    }

    const newSpareSerialNo = spareItem.serialNumber || spareItem.spareId;
    let locationItem = null;

    if (dto.locationInventoryId) {
      locationItem = await prisma.locationInventory.findUnique({
        where: { id: dto.locationInventoryId },
      });
    }

    if (!locationItem && dto.faultySerialNo) {
      locationItem = await prisma.locationInventory.findUnique({
        where: { partSerialNo: dto.faultySerialNo.trim() },
      });
    }

    const oldFaultySerialNo = dto.faultySerialNo.trim();
    const partId = locationItem?.partId || spareItem.partCode || spareItem.productName;

    // Update location inventory record if found
    if (locationItem) {
      await prisma.locationInventory.update({
        where: { id: locationItem.id },
        data: {
          partSerialNo: newSpareSerialNo,
          status: 'INSTALLED',
        },
      });
    }

    // Update stock item in Stock List to DISPATCHED
    const prevStock = spareItem.availableQuantity;
    const newStock = Math.max(0, spareItem.availableQuantity - 1);

    await prisma.inventoryItem.update({
      where: { id: spareItem.id },
      data: {
        availableQuantity: newStock,
        status: 'DISPATCHED',
        reservedFor: `${dto.buildingName} / Room ${dto.roomId} (Replaced Faulty SN: ${oldFaultySerialNo})`,
        updatedById: userId,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Create entry in ReplacementAuditLog
    const auditLog = await prisma.replacementAuditLog.create({
      data: {
        partId,
        oldFaultySerialNo,
        newSpareSerialNo,
        state: dto.targetState,
        buildingName: dto.buildingName,
        roomId: dto.roomId,
        roomName: dto.roomName || locationItem?.roomName || '',
        dispatchedById: userId,
        dispatchedByName: user?.name || 'System User',
      },
    });

    // Movement & Activity Logs
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: spareItem.id,
        type: 'DISPATCH',
        quantity: 1,
        previousStock: prevStock,
        newStock,
        performedById: userId,
        remarks: `Faulty Serial Swap: Installed new spare SN ${newSpareSerialNo} replacing faulty SN ${oldFaultySerialNo} in Room ${dto.roomId} (${dto.buildingName})`,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'SERIAL_SWAP',
        entity: 'LocationInventory',
        entityId: auditLog.id,
        entityLabel: `Swapped Faulty SN ${oldFaultySerialNo} -> New Spare SN ${newSpareSerialNo} (Room: ${dto.roomId}, ${dto.buildingName})`,
      },
    });

    return {
      success: true,
      auditLog,
      spareItem,
      locationItem,
    };
  }
}

export const dispatchService = new DispatchService();
