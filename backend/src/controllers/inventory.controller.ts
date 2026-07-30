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
    const result = await inventoryService.getAll(req.query as any);
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
    const stats = await inventoryService.getDashboardStats();
    ApiResponse.success(res, stats);
  }

  async importExcel(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new AppError(400, 'Please upload an Excel file');
    }
    const store = (req.body.store === 'Bengaluru' ? 'Bengaluru' : 'Delhi') as 'Delhi' | 'Bengaluru';
    const summary = await excelService.importInventory(req.file.buffer, store, req.user!.userId);
    ApiResponse.success(res, summary, `Excel import completed for ${store} store`);
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
