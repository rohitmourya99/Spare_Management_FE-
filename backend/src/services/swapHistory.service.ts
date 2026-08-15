import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { parsePagination, buildPagination } from '../utils/response.util';
import { isBatchOrDummySerial } from '../utils/export.util';

export interface SwapHistoryFilters {
  search?: string;
  roomId?: string;
  partId?: string;
  buildingName?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
}

export interface CreateSwapHistoryDto {
  roomId: string;
  roomName?: string;
  partId: string;
  buildingName?: string;
  floor?: string;
  oldSerialNo: string;
  newSerialNo: string;
  swappedBy?: string;
  swapReason?: string;
  swappedAt?: Date | string;
}

export class SwapHistoryService {
  async create(data: CreateSwapHistoryDto) {
    const swap = await prisma.swapHistory.create({
      data: {
        roomId: data.roomId.trim(),
        roomName: data.roomName?.trim() || null,
        partId: data.partId.trim(),
        buildingName: data.buildingName?.trim() || null,
        floor: data.floor?.trim() || null,
        oldSerialNo: data.oldSerialNo.trim(),
        newSerialNo: data.newSerialNo.trim(),
        swappedBy: data.swappedBy?.trim() || 'System / Technician',
        swapReason: data.swapReason?.trim() || 'Stock Replacement',
        swappedAt: data.swappedAt ? new Date(data.swappedAt) : new Date(),
      },
    });
    return swap;
  }

  async getAll(filters: SwapHistoryFilters) {
    const { page, limit, skip } = parsePagination(filters);
    const where: Prisma.SwapHistoryWhereInput = {};

    if (filters.roomId) where.roomId = { contains: filters.roomId };
    if (filters.partId) where.partId = { contains: filters.partId };
    if (filters.buildingName) where.buildingName = { contains: filters.buildingName };

    if (filters.startDate || filters.endDate) {
      where.swappedAt = {};
      if (filters.startDate) where.swappedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.swappedAt.lte = new Date(filters.endDate);
    }

    if (filters.search) {
      where.OR = [
        { roomId: { contains: filters.search } },
        { roomName: { contains: filters.search } },
        { partId: { contains: filters.search } },
        { buildingName: { contains: filters.search } },
        { floor: { contains: filters.search } },
        { oldSerialNo: { contains: filters.search } },
        { newSerialNo: { contains: filters.search } },
        { swappedBy: { contains: filters.search } },
        { swapReason: { contains: filters.search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.swapHistory.count({ where }),
      prisma.swapHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { swappedAt: 'desc' },
      }),
    ]);

    const cleanedItems = items.map((item) => ({
      ...item,
      oldSerialNo: isBatchOrDummySerial(item.oldSerialNo) ? '' : item.oldSerialNo.trim(),
      newSerialNo: isBatchOrDummySerial(item.newSerialNo) ? '' : item.newSerialNo.trim(),
    }));

    return {
      items: cleanedItems,
      pagination: buildPagination(page, limit, total),
    };
  }

  async exportExcel(filters: SwapHistoryFilters) {
    const where: Prisma.SwapHistoryWhereInput = {};
    if (filters.roomId) where.roomId = { contains: filters.roomId };
    if (filters.partId) where.partId = { contains: filters.partId };
    if (filters.buildingName) where.buildingName = { contains: filters.buildingName };
    if (filters.search) {
      where.OR = [
        { roomId: { contains: filters.search } },
        { roomName: { contains: filters.search } },
        { partId: { contains: filters.search } },
        { buildingName: { contains: filters.search } },
        { oldSerialNo: { contains: filters.search } },
        { newSerialNo: { contains: filters.search } },
        { swappedBy: { contains: filters.search } },
      ];
    }

    const items = await prisma.swapHistory.findMany({
      where,
      orderBy: { swappedAt: 'desc' },
    });

    return items.map((item, idx) => ({
      'S.No': idx + 1,
      'Swap Date & Time': item.swappedAt ? new Date(item.swappedAt).toLocaleString('en-IN') : '',
      'Room ID': item.roomId,
      'Room Name': item.roomName ?? '',
      'Building Name': item.buildingName ?? '',
      Floor: item.floor ?? '',
      'Part ID': item.partId,
      'Old Faulty Serial No': isBatchOrDummySerial(item.oldSerialNo) ? '-' : item.oldSerialNo,
      'New Spare Serial No': isBatchOrDummySerial(item.newSerialNo) ? '-' : item.newSerialNo,
      'Swapped By': item.swappedBy,
      'Swap Reason': item.swapReason ?? '',
    }));
  }
}

export const swapHistoryService = new SwapHistoryService();
