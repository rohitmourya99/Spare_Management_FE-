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
import { UserRole } from '../types';
import { exportToCSV, exportToExcel } from '../utils/export.util';
import { extractOrgId } from '../utils/orgFilter.util';
import { cleanupDispatchSites as cleanupDispatchSitesUtil } from '../utils/cleanupSites';

// Dispatch Controller
export class DispatchController {
  async getAll(req: Request, res: Response) {
    try {
      const orgId = extractOrgId(req);
      const result = await dispatchService.getAll(req.query as any, orgId);
      res.status(200).json({
        success: true,
        data: result.dispatches,
        pagination: result.pagination,
      });
    } catch (err: any) {
      console.error('DispatchController.getAll error:', err);
      res.status(200).json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      });
    }
  }

  async getById(req: Request, res: Response) {
    const dispatch = await dispatchService.getById(req.params.id);
    ApiResponse.success(res, dispatch);
  }

  async create(req: Request, res: Response) {
    try {
      const orgId = extractOrgId(req);
      const userId = req.user?.userId || 'SYSTEM';
      const dispatch = await dispatchService.create(req.body, userId, orgId);
      res.status(200).json({ success: true, message: 'Dispatch created successfully', data: dispatch });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || 'Failed to create dispatch',
        error: err.stack || String(err),
      });
    }
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
    const orgId = extractOrgId(req);
    const result = await pickupService.getAll(req.query as any, orgId);
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
    const orgId = extractOrgId(req);
    const result = await siteService.getAll(req.query as any, orgId);
    ApiResponse.paginated(res, result.sites, result.pagination);
  }

  async getDropdown(req: Request, res: Response) {
    const orgId = extractOrgId(req);
    const sites = await siteService.getAll_dropdown(orgId);
    ApiResponse.success(res, sites);
  }

  async getById(req: Request, res: Response) {
    const site = await siteService.getById(req.params.id);
    ApiResponse.success(res, site);
  }

  async create(req: Request, res: Response) {
    const orgId = extractOrgId(req);
    const site = await siteService.create(req.body, req.user?.userId, orgId);
    ApiResponse.created(res, site, 'Site created');
  }

  async update(req: Request, res: Response) {
    const site = await siteService.update(req.params.id, req.body, req.user?.userId);
    ApiResponse.success(res, site, 'Site updated');
  }

  async delete(req: Request, res: Response) {
    await siteService.delete(req.params.id, req.user?.userId);
    ApiResponse.success(res, null, 'Site deleted');
  }

  async importSites(req: Request, res: Response) {
    if (!req.file) throw new AppError(400, 'Please upload SPOC Excel file');
    const summary = await excelService.importSites(req.file.buffer, req.user!.userId);
    await activityService.logActivity({
      userId: req.user!.userId,
      module: 'Import',
      action: 'Site Master Imported',
      entity: 'SiteMaster',
      entityLabel: `BHEL SPOC Site Master Excel Import (${summary.imported} imported, ${summary.updated} updated)`,
      newValue: `Processed ${summary.totalRows} rows`,
    });
    ApiResponse.success(res, summary, `Site Master Excel import completed`);
  }

  async cleanupDispatchSites(req: Request, res: Response) {
    const result = await cleanupDispatchSitesUtil();
    ApiResponse.success(res, result, `Successfully cleaned up ${result.cleanedCount} auto-created site master records`);
  }
}

// Reports Controller
export class ReportsController {
  async generateReport(req: Request, res: Response) {
    const { type, format } = req.query as { type: string; format: 'excel' | 'pdf' | 'csv' };
    if (!type) throw new AppError(400, 'Report type is required');
    const orgId = extractOrgId(req);

    if (format) {
      if (req.user?.role === UserRole.ENGINEER) {
        ApiResponse.forbidden(res, 'Field Engineers are restricted from downloading reports');
        return;
      }
      await reportsService.exportReport(res, type, format, req.query, orgId);
      await activityService.logActivity({
        userId: req.user!.userId,
        module: 'Reports',
        action: format === 'pdf' ? 'PDF Download' : 'Excel Download',
        entity: 'Report',
        entityLabel: type,
        remarks: `Exported ${type} report as ${format.toUpperCase()}`,
      });
    } else {
      const data = await reportsService.getReportData(type, req.query, orgId);
      ApiResponse.success(res, data);
    }
  }

  /**
   * Named report handler – the report type is resolved at the route level
   * (e.g. GET /reports/full-inventory → type = 'inventory')
   */
  async generateNamedReport(req: Request, res: Response, reportType: string) {
    const { format } = req.query as { format?: 'excel' | 'pdf' | 'csv' };
    const orgId = extractOrgId(req);

    if (format) {
      if (req.user?.role === UserRole.ENGINEER) {
        ApiResponse.forbidden(res, 'Field Engineers are restricted from downloading reports');
        return;
      }
      await reportsService.exportReport(res, reportType, format, req.query, orgId);
      await activityService.logActivity({
        userId: req.user!.userId,
        module: 'Reports',
        action: format === 'pdf' ? 'PDF Download' : 'Excel Download',
        entity: 'Report',
        entityLabel: reportType,
        remarks: `Exported ${reportType} report as ${format.toUpperCase()}`,
      });
    } else {
      const data = await reportsService.getReportData(reportType, req.query, orgId);
      ApiResponse.success(res, data);
    }
  }
}

// User Controller
export class UserController {
  async getAll(req: Request, res: Response) {
    const orgId = extractOrgId(req);
    const result = await userService.getAll(req.query as any, req.user?.role as any, orgId);
    ApiResponse.paginated(res, result.users, result.pagination);
  }

  async getById(req: Request, res: Response) {
    const user = await userService.getById(req.params.id);
    ApiResponse.success(res, user);
  }

  async create(req: Request, res: Response) {
    const user = await userService.create(req.body, req.user as any);
    ApiResponse.created(res, user, 'User created successfully');
  }

  async update(req: Request, res: Response) {
    const user = await userService.update(req.params.id, req.body, req.user as any);
    ApiResponse.success(res, user, 'User updated successfully');
  }

  async updateStatus(req: Request, res: Response) {
    const { status } = req.body;
    let targetStatus = status;
    if (!targetStatus && req.body.isActive !== undefined) {
      targetStatus = req.body.isActive ? 'ACTIVE' : 'DISABLED';
    }
    if (!targetStatus) {
      throw new AppError(400, 'Status is required (ACTIVE, SUSPENDED, or DISABLED)');
    }
    const user = await userService.updateStatus(req.params.id, targetStatus, req.user as any);
    ApiResponse.success(res, user, `User status updated to ${targetStatus}`);
  }

  async updateRole(req: Request, res: Response) {
    const { role } = req.body;
    const user = await userService.update(req.params.id, { role }, req.user as any);
    ApiResponse.success(res, user, 'User role updated successfully');
  }

  async resetPassword(req: Request, res: Response) {
    const password = req.body.newPassword || req.body.password;
    if (!password) {
      throw new AppError(400, 'New password is required');
    }
    await userService.resetPassword(req.params.id, password, req.user as any);
    ApiResponse.success(res, null, 'Password reset successfully');
  }
}

// Activity Controller
export class ActivityController {
  async getAll(req: Request, res: Response) {
    if (req.user?.role === UserRole.READ_ONLY) {
      ApiResponse.forbidden(res, 'Read Only users cannot access Activity Logs');
      return;
    }
    const orgId = extractOrgId(req);
    const result = await activityService.getAll(req.query as any, req.user as any, orgId);
    ApiResponse.paginated(res, result.logs, result.pagination);
  }

  async exportLogs(req: Request, res: Response) {
    if (req.user?.role === UserRole.READ_ONLY) {
      ApiResponse.forbidden(res, 'Read Only users cannot export Activity Logs');
      return;
    }
    const exportData = await activityService.exportLogs(req.query as any, req.user as any);
    const format = ((req.query.format as string) || 'excel').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      exportToCSV(res, exportData as any, `Activity_Logs_${dateStr}`);
    } else {
      exportToExcel(res, exportData as any, 'Activity Logs', `Activity_Logs_${dateStr}.xlsx`);
    }
  }
}

export const dispatchController = new DispatchController();
export const pickupController = new PickupController();
export const rmaController = new RMAController();
export const siteController = new SiteController();
export const reportsController = new ReportsController();
export const userController = new UserController();
export const activityController = new ActivityController();
