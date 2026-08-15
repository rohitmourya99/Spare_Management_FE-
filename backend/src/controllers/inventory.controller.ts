import { Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service';
import { excelService } from '../services/excel.service';
import { commentService } from '../services/comment.service';
import { ApiResponse } from '../utils/response.util';
import { exportToExcel, exportToCSV, exportInventoryToPDF, formatInventoryForExport } from '../utils/export.util';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export class InventoryController {
  async getAll(req: Request, res: Response): Promise<void> {
    const orgId = req.organizationId || (req.headers['x-organization-id'] as string) || 'BHEL';
    const result = await inventoryService.getAll(req.query as any, orgId);
    ApiResponse.paginated(res, result.items, result.pagination);
  }

  async getById(req: Request, res: Response): Promise<void> {
    if (req.params.id === 'new') {
      ApiResponse.success(res, {
        id: 'new',
        spareId: 'NEW-ITEM',
        productName: 'New Inventory Spare Item',
        status: 'AVAILABLE',
        quantity: 1,
        availableQuantity: 1,
        isSerialized: true,
        unit: 'Units',
        store: 'Delhi',
        movements: [],
        dispatches: [],
        pickups: [],
        comments: [],
      });
      return;
    }
    const item = await inventoryService.getById(req.params.id);
    ApiResponse.success(res, item);
  }

  async create(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.create(req.body, req.user!.userId);
    ApiResponse.created(res, item, 'Inventory item created');
  }

  async update(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.update(req.params.id, req.body, req.user!.userId);
    ApiResponse.success(res, item, 'Inventory item updated');
  }

  async delete(req: Request, res: Response): Promise<void> {
    await inventoryService.delete(req.params.id, req.user!.userId);
    ApiResponse.success(res, null, 'Inventory item deleted');
  }

  async getDashboardStats(req: Request, res: Response): Promise<void> {
    const orgId = req.organizationId || (req.headers['x-organization-id'] as string) || 'BHEL';
    const stats = await inventoryService.getDashboardStats(orgId);
    ApiResponse.success(res, stats);
  }

  async getStockAlerts(req: Request, res: Response): Promise<void> {
    const orgId = req.organizationId || (req.headers['x-organization-id'] as string) || 'BHEL';
    const alerts = await inventoryService.getStockAlerts(orgId);
    res.status(200).json({
      success: true,
      ...alerts,
    });
  }

  async getDynamicLowStockDetails(req: Request, res: Response): Promise<void> {
    const details = await inventoryService.getDynamicLowStockDetails();
    res.status(200).json(details);
  }

  async importExcel(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new AppError(400, 'Please upload an Excel file');
    }
    const store = (req.body.store === 'Bengaluru' ? 'Bengaluru' : 'Delhi') as 'Delhi' | 'Bengaluru';
    const summary = await excelService.importInventory(req.file.buffer, store, req.user!.userId);
    ApiResponse.success(res, summary, `Excel import completed for ${store} store`);
  }

  async importLocationInventory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Please upload an Excel file (.xlsx or .xls)' });
        return;
      }
      const summary = await excelService.importLocationInventory(req.file.buffer, req.user!.userId);
      const count = (summary.imported || 0) + (summary.updated || 0);
      res.status(200).json({
        success: true,
        message: `Successfully processed Excel upload! ${summary.imported} created, ${summary.updated} updated.`,
        uploadedCount: count,
        data: summary,
      });
    } catch (error: any) {
      console.error('Error in importLocationInventory:', error);
      res.status(500).json({
        success: false,
        message: error?.message || 'Failed to process Excel upload',
      });
    }
  }

  async getLocationInventories(req: Request, res: Response): Promise<void> {
    const result = await inventoryService.getLocationInventories(req.query as any);
    ApiResponse.paginated(res, result.items, result.pagination);
  }

  async getReplacementAuditLogs(req: Request, res: Response): Promise<void> {
    const result = await inventoryService.getReplacementAuditLogs(req.query as any);
    ApiResponse.paginated(res, result.logs, result.pagination);
  }

  async createReplacementSerialItem(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.createReplacementSerialItem(req.body, req.user!.userId);
    ApiResponse.created(res, item, 'OEM Replacement serial item registered successfully');
  }

  // Mandatory Spare Comments
  async getComments(req: Request, res: Response): Promise<void> {
    if (req.params.id === 'new') {
      ApiResponse.success(res, []);
      return;
    }
    const comments = await commentService.getByInventoryId(req.params.id);
    ApiResponse.success(res, comments);
  }

  async addComment(req: Request, res: Response): Promise<void> {
    if (req.params.id === 'new') {
      ApiResponse.success(res, [], 'Comment registered for draft item');
      return;
    }
    const { comment } = req.body;
    const newComment = await commentService.create(req.params.id, comment, req.user!.userId);
    ApiResponse.created(res, newComment, 'Comment added successfully');
  }

  async updateComment(req: Request, res: Response): Promise<void> {
    const { comment } = req.body;
    const updated = await commentService.update(req.params.commentId, comment, req.user!.userId);
    ApiResponse.success(res, updated, 'Comment updated successfully');
  }

  async replaceSerial(req: Request, res: Response): Promise<void> {
    const { itemId, serialNumber, productName, partCode, oemId, remarks } = req.body;
    const targetId = req.params.id || itemId;
    if (!serialNumber || !serialNumber.trim()) {
      throw new AppError(400, 'Replacement serial number is required');
    }
    const updated = await inventoryService.replaceSerialInPlace(
      { itemId: targetId, serialNumber: serialNumber.trim(), productName, partCode, oemId, remarks },
      req.user!.userId
    );
    ApiResponse.success(res, updated, 'Serial number updated and item set to AVAILABLE');
  }

  async restockItem(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.restockItem(req.params.id, req.body, req.user!.userId);
    ApiResponse.success(res, item, 'Item re-stocked back to AVAILABLE status');
  }

  async replenishItem(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.replenishItem(req.params.id, req.body, req.user!.userId);
    ApiResponse.success(res, item, 'Stock item successfully re-stocked and set to AVAILABLE');
  }

  async archive(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.archiveItem(req.params.id, req.user!.userId);
    ApiResponse.success(res, item, 'Inventory item archived successfully');
  }

  async restore(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.restoreArchivedItem(req.params.id, req.user!.userId);
    ApiResponse.success(res, item, 'Archived inventory item restored successfully');
  }

  async getLocationHierarchy(req: Request, res: Response): Promise<void> {
    const hierarchy = await inventoryService.getLocationHierarchy();
    ApiResponse.success(res, hierarchy);
  }

  async getRoomInstalledItems(req: Request, res: Response): Promise<void> {
    const roomId = (req.query.roomId as string) || (req.params.roomId as string);
    if (!roomId) {
      ApiResponse.success(res, []);
      return;
    }
    const items = await inventoryService.getRoomInstalledItems(roomId);
    ApiResponse.success(res, items);
  }

  // Exports
  async exportExcel(req: Request, res: Response): Promise<void> {
    const { items } = await inventoryService.getAll({ ...req.query as any, limit: '10000' });
    const formatted = formatInventoryForExport(items);
    exportToExcel(res, formatted, 'Inventory', `Spare_Inventory_${new Date().toISOString().split('T')[0]}`);
  }

  async exportCSV(req: Request, res: Response): Promise<void> {
    const { items } = await inventoryService.getAll({ ...req.query as any, limit: '10000' });
    const formatted = formatInventoryForExport(items);
    exportToCSV(res, formatted, `Spare_Inventory_${new Date().toISOString().split('T')[0]}`);
  }

  async exportPDF(req: Request, res: Response): Promise<void> {
    const { items } = await inventoryService.getAll({ ...req.query as any, limit: '10000' });
    exportInventoryToPDF(res, items, 'Spare Parts Inventory Report', `Spare_Inventory_${new Date().toISOString().split('T')[0]}`);
  }

  // Master data endpoints
  async getOEMs(req: Request, res: Response): Promise<void> {
    const oems = await prisma.oEM.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { categories: { where: { isActive: true } } },
    });
    ApiResponse.success(res, oems);
  }

  async createOEM(req: Request, res: Response): Promise<void> {
    const { name } = req.body;
    const oem = await prisma.oEM.create({ data: { name } });
    ApiResponse.created(res, oem, 'OEM created');
  }

  async getCategories(req: Request, res: Response): Promise<void> {
    const { oemId } = req.query;
    const categories = await prisma.category.findMany({
      where: { isActive: true, ...(oemId ? { oemId: String(oemId) } : {}) },
      include: { oem: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    ApiResponse.success(res, categories);
  }

  async createCategory(req: Request, res: Response): Promise<void> {
    const { name, oemId } = req.body;
    const category = await prisma.category.create({ data: { name, oemId } });
    ApiResponse.created(res, category, 'Category created');
  }

  async getLocations(req: Request, res: Response): Promise<void> {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    ApiResponse.success(res, locations);
  }

  async createLocation(req: Request, res: Response): Promise<void> {
    const { name, city } = req.body;
    const location = await prisma.location.create({ data: { name, city } });
    ApiResponse.created(res, location, 'Location created');
  }
}

export const inventoryController = new InventoryController();
