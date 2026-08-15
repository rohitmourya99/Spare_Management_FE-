import { prisma } from '../config/database';
import { exportToExcel, exportToCSV, exportInventoryToPDF, isBatchOrDummySerial } from '../utils/export.util';
import { Response } from 'express';
import { inventoryService } from './inventory.service';

export class ReportsService {
  /**
   * Fetch report dataset based on report type and filters
   */
  async getReportData(reportType: string, filters: any = {}, organizationId: string = 'BHEL') {
    const { store, oemId, startDate, endDate } = filters;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    switch (reportType) {
      case 'inventory': {
        const where: any = { isDeleted: false, organizationId };
        if (store) where.store = store;
        if (oemId) where.oemId = oemId;
        const items = await prisma.inventoryItem.findMany({
          where,
          include: { oem: true, category: true, location: true },
          orderBy: { createdAt: 'desc' },
        });
        return items.map((i) => ({
          'Spare ID': i.spareId,
          'Product Name': i.productName,
          OEM: i.oem.name,
          Category: i.category.name,
          Model: i.model || '',
          'Part Code': i.partCode || '',
          'Serial Number': i.serialNumber || 'N/A',
          'Is Serialized': i.isSerialized ? 'Yes' : 'No',
          Quantity: i.quantity,
          'Available Qty': i.availableQuantity,
          Store: i.store,
          Status: i.status,
          Condition: i.condition,
          'Created Date': i.createdAt.toISOString().split('T')[0],
        }));
      }

      case 'dispatch': {
        const where: any = { organizationId };
        if (startDate || endDate) where.createdAt = dateFilter;
        const dispatches = await prisma.dispatch.findMany({
          where,
          include: {
            inventoryItem: { include: { oem: true } },
            site: true,
            createdBy: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        return dispatches.map((d) => {
          let dispatchedSerial = d.inventoryItem.serialNumber || 'N/A';
          let remarksClean = d.remarks || '';
          if (d.remarks && d.remarks.includes('[Dispatched SN:')) {
            const match = d.remarks.match(/\[Dispatched SN:\s*([^\]]+)\]/);
            if (match && match[1]) {
              dispatchedSerial = match[1].trim();
            }
          }

          return {
            'Part ID': d.inventoryItem.partCode || d.inventoryItem.partId || d.inventoryItem.productName,
            'Dispatched Serial No': dispatchedSerial,
            'Installed Room ID': d.roomId || d.inventoryItem.dispatchedToRoomId || 'N/A',
            'Sublocation': d.sublocation || d.site?.subLocation || 'N/A',
            'State': d.state || d.site?.state || 'N/A',
            'Building Name': d.buildingName || d.site?.siteName || 'N/A',
            'Floor': d.floor || 'N/A',
            'Room Name': d.roomName || 'N/A',
            'Dispatch Date': d.dispatchDate ? new Date(d.dispatchDate).toISOString().replace('T', ' ').substring(0, 19) : d.createdAt.toISOString().replace('T', ' ').substring(0, 19),
            'Dispatched By': d.createdBy.name,
            'Comments / Remarks': remarksClean,
          };
        });
      }

      case 'pickup': {
        const where: any = { organizationId };
        if (startDate || endDate) where.createdAt = dateFilter;
        const pickups = await prisma.pickup.findMany({
          where,
          include: {
            inventoryItem: { include: { oem: true } },
            site: true,
            createdBy: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        return pickups.map((p) => ({
          'Pickup No': p.pickupNo,
          'Spare ID': p.inventoryItem.spareId,
          'Product Name': p.inventoryItem.productName,
          OEM: p.inventoryItem.oem.name,
          'Site Name': p.site.siteName,
          Quantity: p.quantity,
          Courier: p.courierName || '',
          'Tracking No': p.trackingNo || '',
          'Received Confirmed': p.receivedConfirmed ? 'Yes' : 'No',
          Status: p.status,
          'Created By': p.createdBy.name,
          Date: p.createdAt.toISOString().split('T')[0],
        }));
      }

      case 'movement': {
        const where: any = { organizationId };
        if (startDate || endDate) where.createdAt = dateFilter;
        const movements = await prisma.inventoryMovement.findMany({
          where,
          include: {
            inventoryItem: true,
            performedBy: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        return movements.map((m) => ({
          'Spare ID': m.inventoryItem.spareId,
          Product: m.inventoryItem.productName,
          Action: m.type,
          'Qty Transacted': m.quantity,
          'Previous Stock': m.previousStock,
          'New Stock': m.newStock,
          'Performed By': m.performedBy.name,
          Remarks: m.remarks || '',
          Date: m.createdAt.toISOString().replace('T', ' ').substring(0, 19),
        }));
      }

      case 'low_stock': {
        const { allLowStockGroups } = await inventoryService.calculatePartCodeLowStock(organizationId);
        return allLowStockGroups.map((g) => ({
          'Part Code': g.partCode,
          'Product Name': g.productName,
          OEM: g.oemName,
          'Available Stock': g.availableQuantity,
          'Total Uploaded Quantity': g.totalQuantity,
          'Remaining Stock %': `${g.percentRemaining}%`,
          Status: g.availableQuantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK (<=50%)',
        }));
      }

      case 'oem': {
        const oems = await prisma.oEM.findMany({
          include: {
            items: { where: { isDeleted: false } },
          },
        });
        return oems.map((o) => {
          const totalItems = o.items.length;
          const totalQuantity = o.items.reduce((sum, item) => sum + item.quantity, 0);
          const availableQuantity = o.items.reduce(
            (sum, item) => sum + item.availableQuantity,
            0
          );
          return {
            OEM: o.name,
            'Total Unique Spares': totalItems,
            'Total Quantity': totalQuantity,
            'Available Quantity': availableQuantity,
            Status: o.isActive ? 'Active' : 'Inactive',
          };
        });
      }

      case 'activity': {
        const where: any = { organizationId };
        if (startDate || endDate) where.createdAt = dateFilter;
        const logs = await prisma.activityLog.findMany({
          where,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        return logs.map((l) => ({
          User: l.user.name,
          Role: l.user.role,
          Action: l.action,
          Entity: l.entity,
          Label: l.entityLabel || '',
          Date: l.createdAt.toISOString().replace('T', ' ').substring(0, 19),
        }));
      }

      case 'swap_tracking': {
        const where: any = { organizationId };
        if (startDate || endDate) where.swappedAt = dateFilter;
        if (filters.building) where.buildingName = { contains: filters.building };
        if (filters.partId) where.partId = { contains: filters.partId };

        const swaps = await prisma.swapHistory.findMany({
          where,
          orderBy: { swappedAt: 'desc' },
        });

        if (swaps.length > 0) {
          return swaps.map((s) => ({
            'Part ID': s.partId,
            'Old Faulty Serial No': isBatchOrDummySerial(s.oldSerialNo) ? '-' : s.oldSerialNo,
            'New Spare Serial No': isBatchOrDummySerial(s.newSerialNo) ? '-' : s.newSerialNo,
            'Installed Room ID': s.roomId,
            'Room Name': s.roomName || 'N/A',
            'Building Name': s.buildingName || 'N/A',
            Floor: s.floor || 'N/A',
            'Swap Date': new Date(s.swappedAt).toISOString().replace('T', ' ').substring(0, 19),
            'Swapped By': s.swappedBy || 'System / Technician',
            'Swap Reason': s.swapReason || 'Stock Replacement',
          }));
        }

        const auditLogs = await prisma.replacementAuditLog.findMany({
          where,
          include: { dispatchedBy: true },
          orderBy: { swapDate: 'desc' },
        });

        return auditLogs.map((log) => ({
          'Part ID': log.partId,
          'Old Faulty Serial No': isBatchOrDummySerial(log.oldFaultySerialNo) ? '-' : log.oldFaultySerialNo,
          'New Spare Serial No': isBatchOrDummySerial(log.newSpareSerialNo) ? '-' : log.newSpareSerialNo,
          'Installed Room ID': log.roomId,
          'Room Name': log.roomName || 'N/A',
          'Building Name': log.buildingName || 'N/A',
          Floor: 'N/A',
          'Swap Date': new Date(log.swapDate).toISOString().replace('T', ' ').substring(0, 19),
          'Swapped By': log.dispatchedByName || log.dispatchedBy?.name || 'System Dispatcher',
          'Swap Reason': log.state || 'Stock Replacement',
        }));
      }

      case 'comments': {
        const comments = await prisma.comment.findMany({
          where: { inventoryItem: { organizationId } },
          include: {
            inventoryItem: true,
            user: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        return comments.map((c) => ({
          'Spare ID': c.inventoryItem.spareId,
          Product: c.inventoryItem.productName,
          'User Name': c.user.name,
          Role: c.user.role,
          Comment: c.comment,
          Date: c.createdAt.toISOString().replace('T', ' ').substring(0, 19),
        }));
      }

      case 'site_wise': {
        const sites = await prisma.site.findMany({
          where: { organizationId },
          include: {
            dispatches: { include: { inventoryItem: true } },
            pickups: { include: { inventoryItem: true } },
          },
        });
        return sites.map((s) => ({
          'Site Name': s.siteName,
          State: s.state || '',
          City: s.city || '',
          'Total Dispatches': s.dispatches.length,
          'Total Pickups': s.pickups.length,
          'Contact Person': s.contactPerson || '',
        }));
      }

      case 'store_wise': {
        const delhiCount = await prisma.inventoryItem.count({
          where: { store: 'Delhi', isDeleted: false, organizationId },
        });
        const delhiQty = await prisma.inventoryItem.aggregate({
          where: { store: 'Delhi', isDeleted: false, organizationId },
          _sum: { quantity: true, availableQuantity: true },
        });
        const blrCount = await prisma.inventoryItem.count({
          where: { store: 'Bengaluru', isDeleted: false, organizationId },
        });
        const blrQty = await prisma.inventoryItem.aggregate({
          where: { store: 'Bengaluru', isDeleted: false, organizationId },
          _sum: { quantity: true, availableQuantity: true },
        });

        return [
          {
            Store: 'Delhi Spare Store',
            'Unique Parts': delhiCount,
            'Total Items': delhiQty._sum.quantity || 0,
            'Available Stock': delhiQty._sum.availableQuantity || 0,
          },
          {
            Store: 'Bengaluru Spare Store',
            'Unique Parts': blrCount,
            'Total Items': blrQty._sum.quantity || 0,
            'Available Stock': blrQty._sum.availableQuantity || 0,
          },
        ];
      }

      case 'out_of_stock': {
        const where: any = {
          isDeleted: false,
          availableQuantity: 0,
        };
        if (store) where.store = store;
        const items = await prisma.inventoryItem.findMany({
          where,
          include: { oem: true, category: true, location: true },
          orderBy: { productName: 'asc' },
        });
        return items.map((i) => ({
          'Spare ID': i.spareId,
          'Product Name': i.productName,
          OEM: i.oem.name,
          Category: i.category.name,
          Model: i.model || '',
          'Part Code': i.partCode || '',
          Store: i.store,
          'Total Qty': i.quantity,
          'Available Qty': i.availableQuantity,
          Status: 'OUT OF STOCK',
          Condition: i.condition,
        }));
      }

      case 'site_master': {
        const sites = await prisma.site.findMany({
          orderBy: { siteName: 'asc' },
        });
        return sites.map((s) => ({
          'Site Name': s.siteName,
          'Unit / Division': s.unitDivision || '',
          'Sub Location': s.subLocation || '',
          State: s.state || '',
          City: s.city || '',
          PIN: s.pin || '',
          'Contact Person': s.contactPerson || '',
          Phone: s.phone || '',
          Email: s.email || '',
          'Spare Store': s.spareStore || '',
          'Address Line 1': s.addressLine1 || '',
          'Full Address': s.fullAddress || '',
          Remarks: s.remarks || '',
          'Active': s.isActive ? 'Yes' : 'No',
        }));
      }

      case 'warranty_expiry': {
        const days = parseInt((filters.days as string) || '30', 10);
        const now = new Date();
        const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const items = await prisma.inventoryItem.findMany({
          where: {
            isDeleted: false,
            warrantyEnd: {
              gte: now,
              lte: cutoff,
            },
          },
          include: { oem: true, category: true, location: true },
          orderBy: { warrantyEnd: 'asc' },
        });
        return items.map((i) => ({
          'Spare ID': i.spareId,
          'Product Name': i.productName,
          OEM: i.oem.name,
          Category: i.category.name,
          Model: i.model || '',
          'Serial Number': i.serialNumber || 'N/A',
          Store: i.store,
          'Warranty Start': i.warrantyStart ? i.warrantyStart.toISOString().split('T')[0] : '',
          'Warranty End': i.warrantyEnd ? i.warrantyEnd.toISOString().split('T')[0] : '',
          'Days Remaining': i.warrantyEnd
            ? Math.ceil((i.warrantyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : '',
          Status: i.status,
        }));
      }

      default:
        throw new Error('Invalid report type');
    }
  }

  async exportReport(res: Response, reportType: string, format: 'excel' | 'pdf' | 'csv', filters: any, organizationId: string = 'BHEL') {
    const data = await this.getReportData(reportType, filters, organizationId);
    const fileName = `${organizationId}_${reportType}_report_${new Date().toISOString().split('T')[0]}`;

    if (format === 'excel') {
      return exportToExcel(res, data, 'Report', fileName);
    } else if (format === 'csv') {
      return exportToCSV(res, data, fileName);
    } else if (format === 'pdf') {
      return exportInventoryToPDF(res, data as any, `${reportType.toUpperCase()} REPORT`, fileName);
    }
  }
}

export const reportsService = new ReportsService();
