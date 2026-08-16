import { prisma } from '../config/database';

export async function resetTestData(organizationId: string = 'BHEL') {
  try {
    console.log(`🧹 Starting database wipe/reset of test data for organization: ${organizationId}...`);

    // 1. Delete Swap History, File Uploads, RMAs, Receives, Pickups, Dispatches, Reservations
    await prisma.swapHistory.deleteMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
    });

    await prisma.fileUpload.deleteMany({});
    await prisma.rMA.deleteMany({});
    await prisma.receive.deleteMany({});

    await prisma.pickup.deleteMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
    });

    await prisma.dispatch.deleteMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
    });

    await prisma.reservation.deleteMany({});

    // 2. Delete Inventory Comments, Inventory Movements, Inventory Items, Replacement Audit Logs, Location Inventory
    await prisma.comment.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});

    await prisma.inventoryItem.deleteMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
    });

    await prisma.replacementAuditLog.deleteMany({});
    await prisma.locationInventory.deleteMany({});

    // 3. Delete Activity & Audit Logs
    await prisma.activityLog.deleteMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
    });

    console.log(`✅ Successfully wiped test data (Stock, Dispatches, Pickups, Audit Logs) for organization ${organizationId}. Core Master Data (Users, Site Master, OEMs) remain 100% intact.`);

    return {
      success: true,
      message: `Successfully wiped test data for ${organizationId}. Dashboard metrics reset to 0.`,
    };
  } catch (error) {
    console.error('Error during resetTestData:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}
