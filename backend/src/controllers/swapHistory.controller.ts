import { Request, Response } from 'express';
import { swapHistoryService } from '../services/swapHistory.service';
import { ApiResponse } from '../utils/response.util';
import { exportToExcel } from '../utils/export.util';
import { AppError } from '../middleware/error.middleware';

export class SwapHistoryController {
  async getSwapHistory(req: Request, res: Response): Promise<void> {
    const result = await swapHistoryService.getAll(req.query as any);
    ApiResponse.paginated(res, result.items, result.pagination);
  }

  async createSwapHistory(req: Request, res: Response): Promise<void> {
    const { roomId, partId, oldSerialNo, newSerialNo } = req.body;
    if (!roomId || !partId || !oldSerialNo || !newSerialNo) {
      throw new AppError(400, 'roomId, partId, oldSerialNo, and newSerialNo are required fields.');
    }

    const swap = await swapHistoryService.create({
      ...req.body,
      swappedBy: req.body.swappedBy || (req.user as any)?.name || 'Technician',
    });
    ApiResponse.created(res, swap, 'Swap history record created successfully');
  }

  async exportSwapHistory(req: Request, res: Response): Promise<void> {
    const exportData = await swapHistoryService.exportExcel(req.query as any);
    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(res, exportData, 'Swap History', `Swap_Tracking_Audit_History_${dateStr}.xlsx`);
  }
}

export const swapHistoryController = new SwapHistoryController();
