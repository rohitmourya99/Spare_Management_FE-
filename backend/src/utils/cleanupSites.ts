import { prisma } from '../config/database';

export async function cleanupDispatchSites() {
  try {
    const autoSites = await prisma.site.findMany({
      where: {
        OR: [
          { addressLine1: { contains: 'Room:' } },
          { siteName: { contains: '(' } },
          { fullAddress: { contains: '(' } },
        ],
      },
    });

    if (autoSites.length === 0) {
      return { cleanedCount: 0 };
    }

    const autoSiteIds = autoSites.map((s) => s.id);
    const legitimateSites = await prisma.site.findMany({
      where: {
        id: { notIn: autoSiteIds },
      },
    });

    const defaultLegitimateSite = legitimateSites[0];
    if (!defaultLegitimateSite) {
      return { cleanedCount: 0 };
    }

    for (const site of autoSites) {
      const matchingLegitimate =
        legitimateSites.find(
          (ls) =>
            (site.subLocation && ls.subLocation && ls.subLocation.toLowerCase() === site.subLocation.toLowerCase()) ||
            (site.unitDivision && ls.unitDivision && ls.unitDivision.toLowerCase() === site.unitDivision.toLowerCase())
        ) || defaultLegitimateSite;

      await prisma.dispatch.updateMany({
        where: { siteId: site.id },
        data: { siteId: matchingLegitimate.id },
      });

      await prisma.pickup.updateMany({
        where: { siteId: site.id },
        data: { siteId: matchingLegitimate.id },
      });
    }

    const deleteResult = await prisma.site.deleteMany({
      where: {
        id: { in: autoSiteIds },
      },
    });

    console.log(`[DB Cleanup] Cleaned up ${deleteResult.count} auto-created site master records.`);
    return { cleanedCount: deleteResult.count };
  } catch (error) {
    console.error('Error in cleanupDispatchSites:', error);
    return { cleanedCount: 0, error: String(error) };
  }
}
