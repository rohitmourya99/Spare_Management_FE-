import { prisma } from '../config/database';
import { exportToExcel, exportToCSV, exportInventoryToPDF } from '../utils/export.util';
import { Response } from 'express';

export class ReportsService {
  /**
   * Fetch report dataset based on report type and filters
   */
  async getReportData(reportType: string, filters: any = {}) {
    const { store, oemId, startDate, endDate } = filters;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    switch (reportType) {
      case 'inventory': {
        const where: any = { isDeleted: false };
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
        const where: any = {};
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
        return dispatches.map((d) => ({
          'Dispatch No': d.dispatchNo,
          'Spare ID': d.inventoryItem.spareId,
          'Product Name': d.inventoryItem.productName,
          OEM: d.inventoryItem.oem.name,
          'Serial Number': d.inventoryItem.serialNumber || 'N/A',
          'BHEL Site': d.site.siteName,
          City: d.site.city || '',
          'Contact Person': d.site.contactPerson || '',
          Quantity: d.quantity,
          Courier: d.courierName || '',
          'Tracking No': d.trackingNo || '',
          Status: d.status,
          'Dispatched By': d.createdBy.name,
          Date: d.createdAt.toISOString().split('T')[0],
        }));
      }

      case 'pickup': {
        const where: any = {};
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
          'BHEL Site': p.site.siteName,
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
        const where: any = {};
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
        const items = await prisma.inventoryItem.findMany({
          where: {
            isDeleted: false,
            availableQuantity: { lte: 2 },
          },
          include: { oem: true },
          orderBy: { availableQuantity: 'asc' },
        });
        return items.map((i) => ({
          'Spare ID': i.spareId,
          'Product Name': i.productName,
          OEM: i.oem.name,
          Store: i.store,
          'Available Stock': i.availableQuantity,
          'Total Stock': i.quantity,
          Status: i.availableQuantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
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
        const where: any = {};
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

      case 'comments': {
        const comments = await prisma.comment.findMany({
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
          where: { store: 'Delhi', isDeleted: false },
        });
        const delhiQty = await prisma.inventoryItem.aggregate({
          where: { store: 'Delhi', isDeleted: false },
          _sum: { quantity: true, availableQuantity: true },
        });
        const blrCount = await prisma.inventoryItem.count({
          where: { store: 'Bengaluru', isDeleted: false },
        });
        const blrQty = await prisma.inventoryItem.aggregate({
          where: { store: 'Bengaluru', isDeleted: false },
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

  async exportReport(res: Response, reportType: string, format: 'excel' | 'pdf' | 'csv', filters: any) {
    const data = await this.getReportData(reportType, filters);
    const fileName = `${reportType}_report_${new Date().toISOString().split('T')[0]}`;

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
