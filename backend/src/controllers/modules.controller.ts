import { Request, Response } from 'express';
import { dispatchService } from '../services/dispatch.service';
import { pickupService } from '../services/pickup.service';
import { rmaService } from '../services/rma.service';
import { siteService } from '../services/site.service';
import { userService } from '../services/user.service';
import { activityService } from '../services/activity.service';
import { excelService } from '../services/excel.service';
import { reportsService } from '../services/reports.service';
import { ApiResponse } from '../utils/response.util';
import { AppError } from '../middleware/error.middleware';

// Dispatch Controller
export class DispatchController {
  async getAll(req: Request, res: Response) {
    const result = await dispatchService.getAll(req.query as any);
    ApiResponse.paginated(res, result.dispatches, result.pagination);
  }

  async getById(req: Request, res: Response) {
    const dispatch = await dispatchService.getById(req.params.id);
    ApiResponse.success(res, dispatch);
  }

  async create(req: Request, res: Response) {
    const dispatch = await dispatchService.create(req.body, req.user!.userId);
    ApiResponse.created(res, dispatch, 'Dispatch created successfully');
  }

  async approve(req: Request, res: Response) {
    const dispatch = await dispatchService.approve(req.params.id, req.user!.userId);
    ApiResponse.success(res, dispatch, 'Dispatch approved successfully');
  }

  async markDispatched(req: Request, res: Response) {
    const dispatch = await dispatchService.markDispatched(req.params.id, req.body, req.user!.userId);
    ApiResponse.success(res, dispatch, 'Status updated to DISPATCHED');
  }

  async cancel(req: Request, res: Response) {
    await dispatchService.cancel(req.params.id, req.user!.userId);
    ApiResponse.success(res, null, 'Dispatch cancelled');
  }

  async swapFaultySerial(req: Request, res: Response) {
    const result = await dispatchService.swapFaultySerial(req.body, req.user!.userId);
    ApiResponse.success(res, result, 'Faulty serial number swapped and stock item dispatched successfully');
  }
}

// Pickup Controller
export class PickupController {
  async getAll(req: Request, res: Response) {
    const result = await pickupService.getAll(req.query as any);
    ApiResponse.paginated(res, result.pickups, result.pagination);
  }

  async getById(req: Request, res: Response) {
    const pickup = await pickupService.getById(req.params.id);
    ApiResponse.success(res, pickup);
  }

  async create(req: Request, res: Response) {
    const pickup = await pickupService.create(req.body, req.user!.userId);
    ApiResponse.created(res, pickup, 'Pickup created successfully');
  }

  async confirmReceive(req: Request, res: Response) {
    const pickup = await pickupService.confirmReceive(req.params.id, req.user!.userId);
    ApiResponse.success(res, pickup, 'Item received confirmed');
  }

  /** OEM Receipt: creates a new AVAILABLE inventory item for the incoming replacement part */
  async addOemReceipt(req: Request, res: Response) {
    const item = await pickupService.addOemReceipt(req.body, req.user!.userId);
    ApiResponse.created(res, item, 'OEM replacement part added to inventory as AVAILABLE');
  }

  /** List all inventory items created via OEM receipt flow */
  async getOemReceipts(req: Request, res: Response) {
    const result = await pickupService.getOemReceipts(req.query as any);
    ApiResponse.paginated(res, result.items, result.pagination);
  }
}


// RMA Controller
export class RMAController {
  async getAll(req: Request, res: Response) {
    const result = await rmaService.getAll(req.query as any);
    ApiResponse.paginated(res, result.rmas, result.pagination);
  }

  async getById(req: Request, res: Response) {
    const rma = await rmaService.getById(req.params.id);
    ApiResponse.success(res, rma);
  }

  async create(req: Request, res: Response) {
    const rma = await rmaService.create(req.body, req.user!.userId);
    ApiResponse.created(res, rma, 'RMA ticket raised');
  }

  async updateStatus(req: Request, res: Response) {
    const { status, note } = req.body;
    const rma = await rmaService.updateStatus(req.params.id, status, note, req.user!.userId);
    ApiResponse.success(res, rma, 'RMA status updated');
  }
}

// Site Controller
export class SiteController {
  async getAll(req: Request, res: Response) {
    const result = await siteService.getAll(req.query as any);
    ApiResponse.paginated(res, result.sites, result.pagination);
  }

  async getDropdown(req: Request, res: Response) {
    const sites = await siteService.getAll_dropdown();
    ApiResponse.success(res, sites);
  }

  async getById(req: Request, res: Response) {
    const site = await siteService.getById(req.params.id);
    ApiResponse.success(res, site);
  }

  async create(req: Request, res: Response) {
    const site = await siteService.create(req.body);
    ApiResponse.created(res, site, 'Site created');
  }

  async update(req: Request, res: Response) {
    const site = await siteService.update(req.params.id, req.body);
    ApiResponse.success(res, site, 'Site updated');
  }

  async delete(req: Request, res: Response) {
    await siteService.delete(req.params.id);
    ApiResponse.success(res, null, 'Site deleted');
  }

  async importSites(req: Request, res: Response) {
    if (!req.file) throw new AppError(400, 'Please upload SPOC Excel file');
    const summary = await excelService.importSites(req.file.buffer, req.user!.userId);
    ApiResponse.success(res, summary, 'Site master imported successfully');
  }
}

// Reports Controller
export class ReportsController {
  async generateReport(req: Request, res: Response) {
    const { type, format } = req.query as { type: string; format: 'excel' | 'pdf' | 'csv' };
    if (!type) throw new AppError(400, 'Report type is required');

    if (format) {
      await reportsService.exportReport(res, type, format, req.query);
    } else {
      const data = await reportsService.getReportData(type, req.query);
      ApiResponse.success(res, data);
    }
  }

  /**
   * Named report handler – the report type is resolved at the route level
   * (e.g. GET /reports/full-inventory → type = 'inventory')
   */
  async generateNamedReport(req: Request, res: Response, reportType: string) {
    const { format } = req.query as { format?: 'excel' | 'pdf' | 'csv' };

    if (format) {
      await reportsService.exportReport(res, reportType, format, req.query);
    } else {
      const data = await reportsService.getReportData(reportType, req.query);
      ApiResponse.success(res, data);
    }
  }
}

// User Controller
export class UserController {
  async getAll(req: Request, res: Response) {
    const result = await userService.getAll(req.query as any);
    ApiResponse.paginated(res, result.users, result.pagination);
  }

  async getById(req: Request, res: Response) {
    const user = await userService.getById(req.params.id);
    ApiResponse.success(res, user);
  }

  async create(req: Request, res: Response) {
    const user = await userService.create(req.body);
    ApiResponse.created(res, user, 'User created');
  }

  async update(req: Request, res: Response) {
    const user = await userService.update(req.params.id, req.body);
    ApiResponse.success(res, user, 'User updated');
  }

  async updateStatus(req: Request, res: Response) {
    const { status, isActive } = req.body;
    let activeState: boolean | undefined = isActive;
    if (activeState === undefined && status !== undefined) {
      activeState = status === 'ACTIVE';
    }
    const user = await userService.update(req.params.id, { isActive: activeState });
    ApiResponse.success(res, user, 'User status updated');
  }

  async updateRole(req: Request, res: Response) {
    const { role } = req.body;
    const user = await userService.update(req.params.id, { role });
    ApiResponse.success(res, user, 'User role updated');
  }

  async resetPassword(req: Request, res: Response) {
    const password = req.body.newPassword || req.body.password;
    await userService.resetPassword(req.params.id, password);
    ApiResponse.success(res, null, 'Password reset successfully');
  }
}

// Activity Controller
export class ActivityController {
  async getAll(req: Request, res: Response) {
    const result = await activityService.getAll(req.query as any);
    ApiResponse.paginated(res, result.logs, result.pagination);
  }
}

export const dispatchController = new DispatchController();
export const pickupController = new PickupController();
export const rmaController = new RMAController();
export const siteController = new SiteController();
export const reportsController = new ReportsController();
export const userController = new UserController();
export const activityController = new ActivityController();
