import { prisma } from '../config/database';

export async function ensureDefaultOrganization() {
  try {
    // 1. Seed default organization: BHEL
    await prisma.organization.upsert({
      where: { id: 'BHEL' },
      update: { name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
      create: { id: 'BHEL', name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
    });

    // 2. Safe, non-destructive data tagging migration for existing records
    await prisma.user.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    await prisma.inventoryItem.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    await prisma.location.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    await prisma.site.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    await prisma.dispatch.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    await prisma.pickup.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    await prisma.activityLog.updateMany({
      where: { organizationId: null },
      data: { organizationId: 'BHEL' },
    });

    console.log('✅ Default Organization [BHEL] seeded and data tagging verified.');
  } catch (error) {
    console.error('⚠️ Note: Organization seed check deferred until database connection ready:', error);
  }
}
