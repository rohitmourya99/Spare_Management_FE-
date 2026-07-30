import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../config/database';
import { authController } from '../controllers/auth.controller';
import { inventoryController } from '../controllers/inventory.controller';
import {
  dispatchController,
  pickupController,
  rmaController,
  siteController,
  reportsController,
  userController,
  activityController,
} from '../controllers/modules.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../types';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// ==============================================
// HEALTH CHECK ROUTE (Public)
// ==============================================
router.get('/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// AUTH ROUTES (Public)
// ==============================================
const authRoutes = Router();
authRoutes.post('/login', (req, res, next) => authController.login(req, res).catch(next));
authRoutes.post('/refresh-token', (req, res, next) => authController.refreshToken(req, res).catch(next));
authRoutes.post('/logout', authenticate, (req, res, next) => authController.logout(req, res).catch(next));
authRoutes.post('/change-password', authenticate, (req, res, next) => authController.changePassword(req, res).catch(next));
authRoutes.get('/me', authenticate, (req, res, next) => authController.getProfile(req, res).catch(next));

// ==============================================
// INVENTORY ROUTES
// ==============================================
const inventoryRoutes = Router();
inventoryRoutes.use(authenticate);
// Static / Specific Inventory Routes (Placed ABOVE dynamic routes)
inventoryRoutes.get('/dashboard-stats', (req, res, next) => inventoryController.getDashboardStats(req, res).catch(next));
inventoryRoutes.get('/', (req, res, next) => inventoryController.getAll(req, res).catch(next));
inventoryRoutes.post('/import', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), upload.single('file'), (req, res, next) => inventoryController.importExcel(req, res).catch(next));
inventoryRoutes.post('/location-inventory/import', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), upload.single('file'), (req, res, next) => inventoryController.importLocationInventory(req, res).catch(next));
inventoryRoutes.post('/upload-location-excel', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), upload.single('file'), (req, res, next) => inventoryController.importLocationInventory(req, res).catch(next));
inventoryRoutes.get('/location-inventory', (req, res, next) => inventoryController.getLocationInventories(req, res).catch(next));
inventoryRoutes.get('/replacement-audit-logs', (req, res, next) => inventoryController.getReplacementAuditLogs(req, res).catch(next));
inventoryRoutes.get('/replacement-history', (req, res, next) => inventoryController.getReplacementAuditLogs(req, res).catch(next));
inventoryRoutes.post('/new-serial', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.createReplacementSerialItem(req, res).catch(next));

// Manual Inventory Form & Draft Handlers (/new & /new/comments)
inventoryRoutes.get('/new/comments', (req, res, next) => inventoryController.getComments(req, res).catch(next));
inventoryRoutes.post('/new/comments', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.addComment(req, res).catch(next));
inventoryRoutes.get('/new', (req, res, next) => inventoryController.getById(req, res).catch(next));
inventoryRoutes.post('/new', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.create(req, res).catch(next));

// Exports
inventoryRoutes.get('/export/excel', (req, res, next) => inventoryController.exportExcel(req, res).catch(next));
inventoryRoutes.get('/export/csv', (req, res, next) => inventoryController.exportCSV(req, res).catch(next));
inventoryRoutes.get('/export/pdf', (req, res, next) => inventoryController.exportPDF(req, res).catch(next));

// Master Data
inventoryRoutes.get('/oems', (req, res, next) => inventoryController.getOEMs(req, res).catch(next));
inventoryRoutes.post('/oems', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => inventoryController.createOEM(req, res).catch(next));
inventoryRoutes.get('/categories', (req, res, next) => inventoryController.getCategories(req, res).catch(next));
inventoryRoutes.post('/categories', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => inventoryController.createCategory(req, res).catch(next));
inventoryRoutes.get('/locations', (req, res, next) => inventoryController.getLocations(req, res).catch(next));
inventoryRoutes.post('/locations', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => inventoryController.createLocation(req, res).catch(next));

// Replacement Serial Number In-Place Update Endpoint
inventoryRoutes.post('/replace-serial', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.replaceSerial(req, res).catch(next));
inventoryRoutes.put('/:id/replace-serial', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.replaceSerial(req, res).catch(next));

// Comments edit route
inventoryRoutes.put('/comments/:commentId', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.updateComment(req, res).catch(next));

// Dynamic Parameter Routes (Placed LAST)
inventoryRoutes.get('/:id/comments', (req, res, next) => inventoryController.getComments(req, res).catch(next));
inventoryRoutes.post('/:id/comments', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.addComment(req, res).catch(next));

inventoryRoutes.get('/:id', (req, res, next) => inventoryController.getById(req, res).catch(next));
inventoryRoutes.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => inventoryController.create(req, res).catch(next));
inventoryRoutes.put('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => inventoryController.update(req, res).catch(next));
inventoryRoutes.delete('/:id', authorize(UserRole.SUPER_ADMIN), (req, res, next) => inventoryController.delete(req, res).catch(next));

// ==============================================
// DISPATCH ROUTES
// ==============================================
const dispatchRoutes = Router();
dispatchRoutes.use(authenticate);
dispatchRoutes.get('/', (req, res, next) => dispatchController.getAll(req, res).catch(next));
dispatchRoutes.get('/:id', (req, res, next) => dispatchController.getById(req, res).catch(next));
dispatchRoutes.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => dispatchController.create(req, res).catch(next));
dispatchRoutes.post('/:id/approve', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => dispatchController.approve(req, res).catch(next));
dispatchRoutes.put('/:id/status', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => dispatchController.markDispatched(req, res).catch(next));
dispatchRoutes.post('/:id/cancel', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => dispatchController.cancel(req, res).catch(next));
dispatchRoutes.post('/swap', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => dispatchController.swapFaultySerial(req, res).catch(next));

// ==============================================
// PICKUP ROUTES
// ==============================================
const pickupRoutes = Router();
pickupRoutes.use(authenticate);
pickupRoutes.get('/oem-receipts', (req, res, next) => pickupController.getOemReceipts(req, res).catch(next));
pickupRoutes.post('/oem-receipt', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => pickupController.addOemReceipt(req, res).catch(next));
pickupRoutes.get('/', (req, res, next) => pickupController.getAll(req, res).catch(next));
pickupRoutes.get('/:id', (req, res, next) => pickupController.getById(req, res).catch(next));
pickupRoutes.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => pickupController.create(req, res).catch(next));
pickupRoutes.post('/:id/confirm-receive', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => pickupController.confirmReceive(req, res).catch(next));

// ==============================================
// RMA ROUTES
// ==============================================
const rmaRoutes = Router();
rmaRoutes.use(authenticate);
rmaRoutes.get('/', (req, res, next) => rmaController.getAll(req, res).catch(next));
rmaRoutes.get('/:id', (req, res, next) => rmaController.getById(req, res).catch(next));
rmaRoutes.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN, UserRole.ENGINEER), (req, res, next) => rmaController.create(req, res).catch(next));
rmaRoutes.put('/:id/status', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => rmaController.updateStatus(req, res).catch(next));

// ==============================================
// SITE ROUTES
// ==============================================
const siteRoutes = Router();
siteRoutes.use(authenticate);
siteRoutes.get('/dropdown', (req, res, next) => siteController.getDropdown(req, res).catch(next));
siteRoutes.get('/', (req, res, next) => siteController.getAll(req, res).catch(next));
siteRoutes.post('/import', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), upload.single('file'), (req, res, next) => siteController.importSites(req, res).catch(next));
siteRoutes.get('/:id', (req, res, next) => siteController.getById(req, res).catch(next));
siteRoutes.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => siteController.create(req, res).catch(next));
siteRoutes.put('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => siteController.update(req, res).catch(next));
siteRoutes.delete('/:id', authorize(UserRole.SUPER_ADMIN), (req, res, next) => siteController.delete(req, res).catch(next));

// ==============================================
// REPORTS ROUTES
// ==============================================
const reportsRoutes = Router();
reportsRoutes.use(authenticate);
// Generic fallback (supports ?type=&format=)
reportsRoutes.get('/', (req, res, next) => reportsController.generateReport(req, res).catch(next));
// Named report endpoints matching the frontend report keys
reportsRoutes.get('/full-inventory',    (req, res, next) => reportsController.generateNamedReport(req, res, 'inventory').catch(next));
reportsRoutes.get('/low-stock',         (req, res, next) => reportsController.generateNamedReport(req, res, 'low_stock').catch(next));
reportsRoutes.get('/out-of-stock',      (req, res, next) => reportsController.generateNamedReport(req, res, 'out_of_stock').catch(next));
reportsRoutes.get('/oem-wise-stock',    (req, res, next) => reportsController.generateNamedReport(req, res, 'oem').catch(next));
reportsRoutes.get('/dispatch-activity', (req, res, next) => reportsController.generateNamedReport(req, res, 'dispatch').catch(next));
reportsRoutes.get('/pickup-activity',   (req, res, next) => reportsController.generateNamedReport(req, res, 'pickup').catch(next));
reportsRoutes.get('/movement-history',  (req, res, next) => reportsController.generateNamedReport(req, res, 'movement').catch(next));
reportsRoutes.get('/site-wise-dispatch',(req, res, next) => reportsController.generateNamedReport(req, res, 'site_wise').catch(next));
reportsRoutes.get('/site-master',       (req, res, next) => reportsController.generateNamedReport(req, res, 'site_master').catch(next));
reportsRoutes.get('/swap-tracking/export', (req, res, next) => reportsController.generateNamedReport(req, res, 'swap_tracking').catch(next));
reportsRoutes.get('/swap-tracking',        (req, res, next) => reportsController.generateNamedReport(req, res, 'swap_tracking').catch(next));
reportsRoutes.get('/activity',          (req, res, next) => reportsController.generateNamedReport(req, res, 'activity').catch(next));

// ==============================================
// USER ROUTES
// ==============================================
const userRoutes = Router();
userRoutes.use(authenticate);
userRoutes.get('/', (req, res, next) => userController.getAll(req, res).catch(next));
userRoutes.get('/:id', (req, res, next) => userController.getById(req, res).catch(next));
userRoutes.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => userController.create(req, res).catch(next));
userRoutes.put('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => userController.update(req, res).catch(next));
userRoutes.patch('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => userController.update(req, res).catch(next));
userRoutes.patch('/:id/status', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => userController.updateStatus(req, res).catch(next));
userRoutes.patch('/:id/role', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => userController.updateRole(req, res).catch(next));
userRoutes.patch('/:id/reset-password', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => userController.resetPassword(req, res).catch(next));
userRoutes.post('/:id/reset-password', authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN), (req, res, next) => userController.resetPassword(req, res).catch(next));

// ==============================================
// ACTIVITY LOG ROUTES
// ==============================================
const activityRoutes = Router();
activityRoutes.use(authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.INVENTORY_ADMIN));
activityRoutes.get('/', (req, res, next) => activityController.getAll(req, res).catch(next));

// Mount sub-routers
router.use('/auth', authRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/pickup', pickupRoutes);
router.use('/rma', rmaRoutes);
router.use('/sites', siteRoutes);
router.use('/reports', reportsRoutes);
router.use('/users', userRoutes);
router.use('/activity', activityRoutes);

export default router;
