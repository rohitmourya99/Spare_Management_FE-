import { Prisma } from '@prisma/client';
import { RMAStatus } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';

export class RMAService {
  async getAll(filters: { search?: string; status?: RMAStatus; page?: string; limit?: string }) {
    const { page, limit, skip } = parsePagination(filters);
    const where: Prisma.RMAWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { rmaNo: { contains: filters.search } },
        { oemTicketNo: { contains: filters.search } },
        { inventoryItem: { productName: { contains: filters.search } } },
      ];
    }

    const [rmas, total] = await Promise.all([
      prisma.rMA.findMany({
        where,
        include: {
          inventoryItem: {
            select: { spareId: true, productName: true, serialNumber: true, oem: { select: { name: true } } },
          },
          receive: { select: { receiveNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rMA.count({ where }),
    ]);

    return { rmas, pagination: buildPagination(page, limit, total) };
  }

  async getById(id: string) {
    const rma = await prisma.rMA.findUnique({
      where: { id },
      include: {
        inventoryItem: { include: { oem: true, category: true } },
        receive: true,
        fileUploads: true,
      },
    });
    if (!rma) throw new AppError(404, 'RMA not found');
    return rma;
  }

  async create(data: { inventoryItemId: string; receiveId?: string; oemTicketNo?: string; remarks?: string }, userId: string) {
    const count = await prisma.rMA.count();
    const rmaNo = `RMA-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const timelineArr = [{ status: 'RAISED', date: new Date().toISOString(), userId, note: 'RMA raised' }];

    const rma = await prisma.rMA.create({
      data: {
        rmaNo,
        inventoryItemId: data.inventoryItemId,
        receiveId: data.receiveId,
        oemTicketNo: data.oemTicketNo,
        remarks: data.remarks,
        status: RMAStatus.RAISED,
        timeline: JSON.stringify(timelineArr),
      },
    });

    // Update inventory status
    await prisma.inventoryItem.update({
      where: { id: data.inventoryItemId },
      data: { status: 'RMA_PENDING' },
    });

    await prisma.activityLog.create({
      data: { userId, action: 'CREATE', entity: 'RMA', entityId: rma.id, entityLabel: rma.rmaNo },
    });

    return rma;
  }

  async updateStatus(
    id: string,
    status: RMAStatus,
    note: string | undefined,
    userId: string
  ) {
    const rma = await prisma.rMA.findUnique({ where: { id } });
    if (!rma) throw new AppError(404, 'RMA not found');

    let timelineArr: any[] = [];
    if (rma.timeline) {
      try {
        timelineArr = JSON.parse(rma.timeline);
      } catch {
        timelineArr = [];
      }
    }
    timelineArr.push({ status, date: new Date().toISOString(), userId, note });

    const dateField: Record<string, Partial<Prisma.RMAUpdateInput>> = {
      APPROVED: { rmaApprovedDate: new Date() },
      SENT: { rmaSentDate: new Date() },
      RECEIVED: { rmaReceivedDate: new Date() },
      REPLACEMENT_RECEIVED: { replacementDate: new Date() },
      CLOSED: { closedDate: new Date() },
    };

    const updated = await prisma.rMA.update({
      where: { id },
      data: {
        status,
        timeline: JSON.stringify(timelineArr),
        ...(dateField[status] ?? {}),
      },
    });

    // Update inventory item status
    const invStatus = status === 'REPLACEMENT_RECEIVED' ? 'AVAILABLE'
      : status === 'SENT' ? 'RMA_SENT'
      : status === 'RECEIVED' ? 'RMA_RECEIVED'
      : undefined;

    if (invStatus) {
      await prisma.inventoryItem.update({
        where: { id: rma.inventoryItemId },
        data: { status: invStatus },
      });
    }

    await prisma.activityLog.create({
      data: { userId, action: 'UPDATE', entity: 'RMA', entityId: id, entityLabel: `${rma.rmaNo} → ${status}` },
    });

    return updated;
  }
}

export const rmaService = new RMAService();
