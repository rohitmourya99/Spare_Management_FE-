import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function patchLegacyOrganizationRecords(): Promise<void> {
  try {
    // 1. Guarantee BHEL & METLIFE Organizations exist in DB
    await prisma.organization.upsert({
      where: { id: 'BHEL' },
      update: { name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
      create: { id: 'BHEL', name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
    });

    await prisma.organization.upsert({
      where: { id: 'METLIFE' },
      update: { name: 'METLIFE', code: 'METLIFE', status: 'ACTIVE' },
      create: { id: 'METLIFE', name: 'METLIFE', code: 'METLIFE', status: 'ACTIVE' },
    });

    // 2. Patch null organizationId records across all tables
    const stockPatched = await prisma.inventoryItem.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    const sitePatched = await prisma.site.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    const userPatched = await prisma.user.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    const locationPatched = await prisma.location.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    const dispatchPatched = await prisma.dispatch.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    const pickupPatched = await prisma.pickup.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    const activityPatched = await prisma.activityLog.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    logger.info(`✅ Auto-Tagged Untagged Legacy Records with BHEL Org ID:
    - StockItems / Inventory (InventoryItem): ${stockPatched.count}
    - SiteMaster (Site): ${sitePatched.count}
    - Users: ${userPatched.count}
    - Locations: ${locationPatched.count}
    - Dispatches: ${dispatchPatched.count}
    - Pickups: ${pickupPatched.count}
    - Activity Logs: ${activityPatched.count}`);
  } catch (error) {
    logger.warn('⚠️ Legacy organization record patch warning:', error);
  }
}

// Standalone execution if run directly via tsx
if (require.main === module) {
  patchLegacyOrganizationRecords()
    .then(() => {
      console.log('Legacy org patch completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error executing legacy org patch:', err);
      process.exit(1);
    });
}
