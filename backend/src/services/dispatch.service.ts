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

    return { dispatches, pagination: buildPagination(page, limit, total) };
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
    return dispatch;
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
    // When all stock is dispatched, mark as RESERVED (not DISPATCHED).
    // RESERVED means: part is at a site, slot is waiting for OEM replacement.
    // User can manually move to DISPATCHED via inventory status dropdown if needed.
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
          remarks: data.remarks,
          status: DispatchStatus.DISPATCHED,
          createdById: userId,
          approvedById: userId,
          approvedAt: now,
        },
        include: {
          inventoryItem: { select: { spareId: true, productName: true } },
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
}

export const dispatchService = new DispatchService();
