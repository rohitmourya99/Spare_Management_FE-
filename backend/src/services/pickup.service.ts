import { Prisma } from '@prisma/client';
import { PickupStatus } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';
import { activityService } from './activity.service';

export interface CreatePickupDto {
  inventoryItemId: string;
  siteId: string;
  quantity: number;
  courierName?: string;
  trackingNo?: string;
  faultDescription?: string;
  pickupDate?: string;
  remarks?: string;
}

export interface OemReceiptDto {
  // New part details coming in from OEM
  productName: string;
  partCode?: string;
  oemId?: string;
  categoryId?: string;
  serialNumber?: string;
  isSerialized?: boolean;
  store: 'Delhi' | 'Bengaluru';
  rack?: string;
  bin?: string;
  quantity?: number;
  unit?: string;
  remarks?: string;
  // Optionally link to an existing pickup request
  linkedPickupId?: string;
}

export class PickupService {
  async getAll(filters: { search?: string; status?: PickupStatus; page?: string; limit?: string }, organizationId: string = 'BHEL') {
    const { page, limit, skip } = parsePagination(filters);
    const where: Prisma.PickupWhereInput = { organizationId };

    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { pickupNo: { contains: filters.search } },
        { trackingNo: { contains: filters.search } },
        { site: { siteName: { contains: filters.search } } },
        { faultDescription: { contains: filters.search } },
      ];
    }

    const [pickups, total] = await Promise.all([
      prisma.pickup.findMany({
        where,
        include: {
          inventoryItem: { select: { spareId: true, productName: true, oem: { select: { name: true } } } },
          site: { select: { siteName: true, city: true, contactPerson: true, phone: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pickup.count({ where }),
    ]);

    return { pickups, pagination: buildPagination(page, limit, total) };
  }

  async getById(id: string) {
    const pickup = await prisma.pickup.findUnique({
      where: { id },
      include: {
        inventoryItem: { include: { oem: true, category: true, location: true } },
        site: true,
        createdBy: { select: { id: true, name: true, email: true } },
        receives: true,
        fileUploads: true,
      },
    });
    if (!pickup) throw new AppError(404, 'Pickup not found');
    return pickup;
  }

  async create(data: CreatePickupDto, userId: string) {
    const count = await prisma.pickup.count();
    const pickupNo = `PU-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const pickup = await prisma.pickup.create({
      data: {
        pickupNo,
        inventoryItemId: data.inventoryItemId,
        siteId: data.siteId,
        quantity: data.quantity || 1,
        courierName: data.courierName,
        trackingNo: data.trackingNo,
        faultDescription: data.faultDescription,
        pickupDate: data.pickupDate ? new Date(data.pickupDate) : new Date(),
        remarks: data.remarks,
        status: PickupStatus.PICKED_UP,
        createdById: userId,
      },
    });

    await prisma.activityLog.create({
      data: { userId, action: 'PICKUP', entity: 'Pickup', entityId: pickup.id, entityLabel: pickup.pickupNo },
    });

    return pickup;
  }

  async confirmReceive(id: string, userId: string) {
    const pickup = await prisma.pickup.findUnique({
      where: { id },
      include: { inventoryItem: true, site: true },
    });
    if (!pickup) throw new AppError(404, 'Pickup not found');

    const item = pickup.inventoryItem;
    const newAvail = item.availableQuantity + pickup.quantity;
    const newTotal = item.quantity + pickup.quantity;

    const [updated] = await prisma.$transaction([
      prisma.pickup.update({
        where: { id },
        data: {
          status: PickupStatus.RECEIVED,
          receivedConfirmed: true,
          receivedDate: new Date(),
        },
      }),
      prisma.inventoryItem.update({
        where: { id: pickup.inventoryItemId },
        data: {
          quantity: newTotal,
          availableQuantity: newAvail,
          status: 'AVAILABLE',
        },
      }),
      prisma.inventoryMovement.create({
        data: {
          inventoryItemId: pickup.inventoryItemId,
          type: 'PICKUP',
          quantity: pickup.quantity,
          previousStock: item.availableQuantity,
          newStock: newAvail,
          referenceId: pickup.pickupNo,
          performedById: userId,
          remarks: `Pickup confirmation from site (Pickup #${pickup.pickupNo})`,
        },
      }),
    ]);

    await activityService.logActivity({
      userId,
      module: 'Pickup',
      action: 'Pickup Completed',
      entity: 'Pickup',
      entityId: id,
      entityLabel: `${pickup.pickupNo} - ${item.productName}`,
      partCode: item.partCode || undefined,
      serialNumber: item.serialNumber || undefined,
      siteName: pickup.site?.siteName,
      oldValue: `Status: ${pickup.status}`,
      newValue: `Status: RECEIVED, Available Stock: ${newAvail}`,
    });

    return updated;
  }

  /**
   * OEM Receipt: When a replacement part arrives from OEM, this creates a brand-new
   * inventory item row with status AVAILABLE, so it immediately appears in the inventory list.
   * Optionally links to an existing pickup request to mark it RECEIVED.
   */
  async addOemReceipt(data: OemReceiptDto, userId: string) {
    const qty = data.quantity || 1;

    // Resolve oemId — schema requires a valid string (non-null).
    // If user didn't pick one, upsert a fallback "OEM (Unspecified)" record.
    let resolvedOemId = data.oemId;
    if (!resolvedOemId) {
      const fallbackOem = await prisma.oEM.upsert({
        where: { name: 'OEM (Unspecified)' },
        create: { name: 'OEM (Unspecified)' },
        update: {},
      });
      resolvedOemId = fallbackOem.id;
    }

    // Resolve categoryId — schema requires a valid string (non-null).
    let resolvedCategoryId = data.categoryId;
    if (!resolvedCategoryId) {
      const fallbackCat = await prisma.category.upsert({
        where: { name_oemId: { name: 'General', oemId: resolvedOemId } },
        create: { name: 'General', oemId: resolvedOemId },
        update: {},
      });
      resolvedCategoryId = fallbackCat.id;
    }

    // Match Logic: Check for an existing item with matching OEM + Part Name / SKU in RESERVED / DISPATCHED state
    const existingMatch = await prisma.inventoryItem.findFirst({
      where: {
        isDeleted: false,
        oemId: resolvedOemId,
        OR: [
          { productName: { equals: data.productName } },
          data.partCode ? { partCode: { equals: data.partCode } } : {},
        ].filter((c) => Object.keys(c).length > 0),
        status: { in: ['RESERVED', 'DISPATCHED', 'IN_TRANSIT'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        oem: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    let newItem;
    if (existingMatch) {
      const dispatchDate = existingMatch.dispatchDate;
      const oemPickupDate = new Date();
      let turnaroundDays = undefined;
      if (dispatchDate) {
        const diffMs = oemPickupDate.getTime() - new Date(dispatchDate).getTime();
        turnaroundDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      // In-Place Update on existing item (No duplicate entry created)
      newItem = await prisma.inventoryItem.update({
        where: { id: existingMatch.id },
        data: {
          ...(data.serialNumber ? { serialNumber: data.serialNumber.trim(), isSerialized: true } : {}),
          status: 'AVAILABLE',
          availableQuantity: existingMatch.quantity > 0 ? existingMatch.quantity : (existingMatch.availableQuantity + qty),
          oemPickupDate,
          turnaroundDays,
          remarks: data.remarks || `OEM replacement serial number updated in-place: ${data.serialNumber || 'N/A'} (Turnaround: ${turnaroundDays !== undefined ? turnaroundDays + ' days' : 'N/A'})`,
          updatedById: userId,
        },
        include: {
          oem: { select: { name: true } },
          category: { select: { name: true } },
        },
      });
    } else {
      // Build a unique spare ID for the new inventory entry
      const invCount = await prisma.inventoryItem.count();
      const spareId = `SP-OEM-${new Date().getFullYear()}-${String(invCount + 1).padStart(5, '0')}`;

      // Create the new inventory item as AVAILABLE
      newItem = await prisma.inventoryItem.create({
        data: {
          spareId,
          productName: data.productName,
          ...(data.partCode ? { partCode: data.partCode } : {}),
          oemId: resolvedOemId,
          categoryId: resolvedCategoryId,
          serialNumber: data.isSerialized !== false && data.serialNumber ? data.serialNumber : null,
          isSerialized: data.isSerialized !== false && !!data.serialNumber,
          quantity: qty,
          availableQuantity: qty,
          unit: data.unit || 'Pcs',
          store: data.store,
          ...(data.rack ? { rack: data.rack } : {}),
          ...(data.bin ? { bin: data.bin } : {}),
          status: 'AVAILABLE',
          remarks: data.remarks || `Received from OEM replacement`,
          createdById: userId,
          updatedById: userId,
        },
        include: {
          oem: { select: { name: true } },
          category: { select: { name: true } },
        },
      });
    }

    const faultySerial = (data as any).originalSerialNumber || (existingMatch ? existingMatch.serialNumber : null) || 'N/A';
    const newSerial = data.serialNumber ? data.serialNumber.trim() : 'N/A';
    const oemName = newItem.oem?.name || 'OEM';

    // Log detailed audit history trace
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'OEM_REPLACEMENT_RECEIPT',
        entity: 'Pickup',
        entityId: newItem.id,
        entityLabel: `OEM Replacement Trace — OEM: ${oemName} | Part: ${data.productName} | Original SN: ${faultySerial} -> New SN: ${newSerial} | Date: ${new Date().toISOString()} | Location: ${data.store}`,
      },
    });

    // Log the inventory movement as a RECEIPT with replacement trace remarks
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: newItem.id,
        type: 'RECEIPT',
        quantity: qty,
        previousStock: existingMatch ? existingMatch.availableQuantity : 0,
        newStock: newItem.availableQuantity,
        referenceId: newItem.spareId || 'OEM-RECEIPT',
        performedById: userId,
        remarks: `[REPLACEMENT HISTORY TRACE] OEM: ${oemName} | Part: ${data.productName} (${data.partCode || 'N/A'}) | Faulty/Orig SN: ${faultySerial} | New Replacement SN: ${newSerial} | Date: ${new Date().toISOString()} | Location: ${data.store}`,
      },
    });

    // If linked to a pickup request, mark it as RECEIVED
    if (data.linkedPickupId) {
      await prisma.pickup.update({
        where: { id: data.linkedPickupId },
        data: {
          status: PickupStatus.RECEIVED,
          receivedConfirmed: true,
          receivedDate: new Date(),
          remarks: `OEM replacement received — New SN: ${data.serialNumber || 'N/A'} | Inv ID: ${newItem.spareId}`,
        },
      }).catch(() => {
        // Silently ignore if pickup not found — receipt creation still succeeds
      });
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'RECEIPT',
        entity: 'InventoryItem',
        entityId: newItem.id,
        entityLabel: `OEM Receipt: ${newItem.productName} (SN: ${data.serialNumber || 'N/A'}) → ${newItem.spareId}`,
      },
    });

    return newItem;
  }

  /**
   * Get all OEM receipt history (inventory items created via OEM receipt flow)
   */
  async getOemReceipts(filters: { search?: string; page?: string; limit?: string }) {
    const { page, limit, skip } = parsePagination(filters);

    const where: Prisma.InventoryItemWhereInput = {
      isDeleted: false,
      spareId: { startsWith: 'SP-OEM-' },
    };

    if (filters.search) {
      where.OR = [
        { productName: { contains: filters.search } },
        { serialNumber: { contains: filters.search } },
        { partCode: { contains: filters.search } },
        { spareId: { contains: filters.search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          oem: { select: { name: true } },
          category: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return { items, pagination: buildPagination(page, limit, total) };
  }
}

export const pickupService = new PickupService();
