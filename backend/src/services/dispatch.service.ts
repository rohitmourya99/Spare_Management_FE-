import { Prisma } from '@prisma/client';
import { DispatchStatus, InventoryStatus } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';
import { activityService } from './activity.service';
import { buildOrgFilter } from '../utils/orgFilter.util';

export interface CreateDispatchDto {
  inventoryItemId?: string;
  stockItemId?: string;
  dispatchedSerialNo?: string;
  faultySerialNo?: string;
  faultyItemId?: string;
  faultyPartCode?: string;
  faultySerialNumber?: string;
  siteId?: string;
  unit?: string;
  sublocation?: string;
  state?: string;
  floor?: string;
  buildingName?: string;
  roomName?: string;
  roomId?: string;
  solutionType?: string;
  locationClass?: string;
  quantity?: number;
  courierName?: string;
  trackingNo?: string;
  dispatchDate?: string;
  expectedDelivery?: string;
  engineerName?: string;
  remarks?: string;
  comments?: string;
}

export class DispatchService {
  async getAll(filters: {
    search?: string;
    status?: DispatchStatus;
    siteId?: string;
    page?: string;
    limit?: string;
  }, organizationId: string = 'BHEL') {
    const { page, limit, skip } = parsePagination(filters);
    const orgFilter = buildOrgFilter(organizationId);
    const where: Prisma.DispatchWhereInput = { AND: [orgFilter] };

    if (filters.status) where.status = filters.status;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.search) {
      (where.AND as any[]).push({
        OR: [
          { dispatchNo: { contains: filters.search } },
          { trackingNo: { contains: filters.search } },
          { site: { siteName: { contains: filters.search } } },
          { inventoryItem: { productName: { contains: filters.search } } },
          { buildingName: { contains: filters.search } },
          { roomId: { contains: filters.search } },
        ],
      });
    }

    const [dispatches, total] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          inventoryItem: { select: { spareId: true, productName: true, model: true, partCode: true, store: true, serialNumber: true, isSerialized: true, oem: { select: { name: true } } } },
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

    // Map originalSerialNumber and replacedFaulty from remarks for immutability
    const mappedDispatches = dispatches.map((d) => {
      let originalSerial = d.inventoryItem?.serialNumber || null;
      if (d.remarks && d.remarks.includes('[Dispatched SN:')) {
        const match = d.remarks.match(/\[Dispatched SN:\s*([^\]]+)\]/);
        if (match && match[1]) {
          originalSerial = match[1].trim();
        }
      }

      let replacedFaulty: { partCode?: string; serialNumber?: string } | null = null;
      if (d.remarks && d.remarks.includes('[Replaced Faulty:')) {
        const match = d.remarks.match(/\[Replaced Faulty:\s*([^|]+)\|\s*SN:\s*([^\]]+)\]/);
        if (match) {
          replacedFaulty = {
            partCode: match[1].trim(),
            serialNumber: match[2].trim(),
          };
        }
      }

      return {
        ...d,
        originalSerialNumber: originalSerial,
        replacedFaulty,
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

  async create(data: CreateDispatchDto, userId: string, organizationId: string = 'BHEL') {
    const itemId = data.inventoryItemId || data.stockItemId;
    if (!itemId) throw new AppError(400, 'Inventory item ID is required');

    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId, isDeleted: false },
      include: { oem: true },
    });
    if (!item) throw new AppError(404, 'Inventory item not found');

    const targetOrgId = (data as any).organizationId || organizationId || item.organizationId || 'BHEL';

    const qtyToDispatch = data.quantity || 1;
    if (item.availableQuantity < qtyToDispatch) {
      throw new AppError(
        400,
        `Insufficient available stock. Requested: ${qtyToDispatch}, Available: ${item.availableQuantity}`
      );
    }

    // Auto-map location details from existing LocationInventory if missing
    if (data.roomId) {
      const locInv = await prisma.locationInventory.findFirst({
        where: { roomId: data.roomId },
      });
      if (locInv) {
        data.buildingName = data.buildingName || locInv.buildingName || undefined;
        data.floor = data.floor || locInv.floor || undefined;
        data.solutionType = data.solutionType || locInv.solutionType || undefined;
        data.locationClass = data.locationClass || locInv.locationClass || undefined;
        data.roomName = data.roomName || locInv.roomName || undefined;
        data.sublocation = data.sublocation || locInv.subUnit || undefined;
      }
    }

    const buildingName = data.buildingName || (data.roomId ? `Room ${data.roomId}` : 'Main Building');

    // Resolve or find/create Site if siteId is missing
    let targetSiteId = data.siteId;
    if (!targetSiteId) {
      const siteName = `${buildingName} ${data.roomName ? '- ' + data.roomName : ''} (${data.roomId || 'Site'})`.trim();
      
      let existingSite = await prisma.site.findFirst({
        where: {
          OR: [
            { siteName: { equals: siteName } },
            { fullAddress: { equals: siteName } },
          ],
        },
      });

      if (!existingSite) {
        existingSite = await prisma.site.create({
          data: {
            siteName,
            unitDivision: data.unit || 'Main Unit',
            subLocation: data.sublocation || 'Main Sublocation',
            locationClass: data.locationClass || 'Class A',
            addressLine1: `${buildingName}, Room: ${data.roomId || 'N/A'}`,
            fullAddress: siteName,
            city: data.state || 'Delhi',
            state: data.state || 'Delhi',
            organizationId: targetOrgId,
          },
        });
      }
      targetSiteId = existingSite.id;
    }

    const count = await prisma.dispatch.count();
    const dispatchNo = `DS-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const newAvail = Math.max(0, item.availableQuantity - qtyToDispatch);
    const newStatus = 'DISPATCHED';

    // Capture exact live timestamp
    const now = new Date();
    let dispatchTimestamp = now;
    if (data.dispatchDate) {
      const selected = new Date(data.dispatchDate);
      if (!isNaN(selected.getTime())) {
        selected.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        dispatchTimestamp = selected;
      }
    }

    // Optional user remarks / comments & faulty item swap formatting
    const userComments = (data.comments || data.remarks || '').trim();
    const originalSerial = data.dispatchedSerialNo || item.serialNumber || 'Bulk';
    
    const faultyPart = data.faultyPartCode || (data.faultyItemId ? 'Installed Faulty' : null);
    const faultySerial = data.faultySerialNumber || data.faultySerialNo || null;
    const faultyText = faultyPart || faultySerial
      ? `[Replaced Faulty: ${faultyPart || 'Faulty'} | SN: ${faultySerial || 'Non-Serialized'}]`
      : '';

    const lockedRemarks = [faultyText, `[Dispatched SN: ${originalSerial}]`, userComments].filter(Boolean).join(' ');

    // Transaction array for atomic database operations
    const txOperations: Prisma.PrismaPromise<any>[] = [
      prisma.dispatch.create({
        data: {
          dispatchNo,
          inventoryItemId: itemId,
          siteId: targetSiteId,
          organizationId: targetOrgId,
          quantity: qtyToDispatch,
          courierName: data.courierName || null,
          trackingNo: data.trackingNo || null,
          dispatchDate: dispatchTimestamp,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          remarks: lockedRemarks,
          sublocation: data.sublocation || null,
          floor: data.floor || null,
          buildingName: buildingName,
          roomName: data.roomName || null,
          roomId: data.roomId || null,
          solutionType: data.solutionType || null,
          locationClass: data.locationClass || null,
          status: DispatchStatus.DISPATCHED,
          createdById: userId,
          approvedById: userId,
          approvedAt: now,
        },
        include: {
          inventoryItem: { select: { spareId: true, productName: true, serialNumber: true, store: true, partCode: true } },
          site: { select: { siteName: true } },
        },
      }),
      prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          availableQuantity: newAvail,
          status: newStatus,
          dispatchedToRoomId: data.roomId || null,
          dispatchDate: dispatchTimestamp,
          remarks: userComments || item.remarks,
          updatedById: userId,
        },
      }),
      prisma.inventoryMovement.create({
        data: {
          inventoryItemId: itemId,
          type: 'DISPATCH',
          quantity: qtyToDispatch,
          previousStock: item.availableQuantity,
          newStock: newAvail,
          referenceId: dispatchNo,
          performedById: userId,
          remarks: `Dispatched to site (${buildingName} / Room ${data.roomId || 'N/A'}) (Dispatch #${dispatchNo})`,
        },
      }),
    ];

    if (faultyPart || faultySerial) {
      txOperations.push(
        prisma.swapHistory.create({
          data: {
            roomId: data.roomId || 'ROOM-GENERAL',
            roomName: data.roomName || '',
            partId: faultyPart || item.partCode || item.productName,
            buildingName: buildingName,
            floor: data.floor || '',
            oldSerialNo: faultySerial || 'Non-Serialized',
            newSerialNo: originalSerial,
            swappedBy: userId,
            swapReason: `Dispatch Replacement (Dispatch #${dispatchNo})`,
          },
        })
      );
    }

    // Run all core creation & update queries inside a single Prisma transaction
    const txResults = await prisma.$transaction(txOperations);
    const dispatch = txResults[0];

    // Non-critical post-transaction automation wrapped safely
    try {
      if (data.roomId || buildingName) {
        const partSerialNo = originalSerial !== 'Bulk' && originalSerial ? originalSerial : `${item.spareId}-${Date.now()}`;
        const partId = item.partCode || item.partId || item.productName;
        const oemName = item.oem?.name || 'Standard OEM';

        const existingLocInv = await prisma.locationInventory.findUnique({
          where: { partSerialNo },
        });

        if (existingLocInv) {
          await prisma.locationInventory.update({
            where: { id: existingLocInv.id },
            data: {
              installationDate: dispatchTimestamp,
              oem: oemName,
              partId,
              roomId: data.roomId || existingLocInv.roomId,
              locationClass: data.locationClass || existingLocInv.locationClass,
              solutionType: data.solutionType || existingLocInv.solutionType,
              buildingName: buildingName || existingLocInv.buildingName,
              roomName: data.roomName || existingLocInv.roomName,
              floor: data.floor || existingLocInv.floor,
              subUnit: data.sublocation || existingLocInv.subUnit,
            },
          });
        } else {
          await prisma.locationInventory.create({
            data: {
              installationDate: dispatchTimestamp,
              oem: oemName,
              partId,
              partSerialNo,
              roomId: data.roomId || 'ROOM-GENERAL',
              buildingName: buildingName,
              roomName: data.roomName || '',
              floor: data.floor || '',
              unit: data.unit || 'Main Unit',
              subUnit: data.sublocation || 'Main Sublocation',
              state: data.state || 'Delhi',
              solutionType: data.solutionType || 'General',
              locationClass: data.locationClass || 'Class A',
            },
          });
        }
      }

      if (userComments) {
        await prisma.comment.create({
          data: {
            inventoryItemId: itemId,
            userId,
            comment: `[DISPATCH REMARK - #${dispatchNo}] ${userComments}`,
          },
        });
      }

      await activityService.logActivity({
        userId,
        module: 'Dispatch',
        action: 'Dispatch Created',
        entity: 'Dispatch',
        entityId: dispatch.id,
        entityLabel: `${dispatch.dispatchNo} - ${item.productName}`,
        partCode: item.partCode || item.partId || undefined,
        serialNumber: originalSerial,
        siteName: buildingName || dispatch.site?.siteName || undefined,
        oldValue: `Stock: ${item.availableQuantity}`,
        newValue: `Dispatched Qty: ${qtyToDispatch}, Remaining: ${newAvail}`,
        remarks: userComments || `Dispatched to ${buildingName} / Room ${data.roomId || 'N/A'}`,
      });
    } catch (automationError) {
      console.warn('Post-dispatch non-critical automation warning:', automationError);
    }

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
        dispatchedToRoomId: dto.roomId,
        replacedFaultySerialNo: oldFaultySerialNo,
        dispatchDate: new Date(),
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

    // Create entry in SwapHistory
    await prisma.swapHistory.create({
      data: {
        roomId: dto.roomId,
        roomName: dto.roomName || locationItem?.roomName || null,
        partId,
        buildingName: dto.buildingName || null,
        oldSerialNo: oldFaultySerialNo,
        newSerialNo: newSpareSerialNo,
        swappedBy: user?.name || 'System User',
        swapReason: dto.remarks || 'Stock Replacement Dispatch',
        swappedAt: new Date(),
      },
    }).catch(() => {});

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
