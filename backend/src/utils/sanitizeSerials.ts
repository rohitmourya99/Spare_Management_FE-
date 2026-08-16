import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Sanitizes existing database records across InventoryItem and LocationInventory tables.
 * Resets synthetic dummy serial strings (_Not Applicable_, BATCH_, XYZ, etc.) to null / ''.
 */
export async function sanitizeDatabaseSerialNumbers(): Promise<void> {
  try {
    // 1. Sanitize InventoryItem records
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        OR: [
          { serialNumber: { contains: '_Not Applicable_' } },
          { serialNumber: { contains: '_NOT APPLICABLE_' } },
          { serialNumber: { contains: 'BATCH_' } },
          { serialNumber: { contains: 'XYZ' } },
          { serialNumber: { contains: 'Not Applicable' } },
          { serialNumber: { equals: '-' } },
        ],
      },
      select: { id: true },
    });

    if (inventoryItems.length > 0) {
      await prisma.inventoryItem.updateMany({
        where: {
          id: { in: inventoryItems.map((i) => i.id) },
        },
        data: {
          serialNumber: null,
          isSerialized: false,
        },
      });
      logger.info(`Sanitized ${inventoryItems.length} inventory items with synthetic serial numbers`);
    }

    // 2. Sanitize LocationInventory records
    const locItems = await prisma.locationInventory.findMany({
      where: {
        OR: [
          { partSerialNo: { contains: '_Not Applicable_' } },
          { partSerialNo: { contains: '_NOT APPLICABLE_' } },
          { partSerialNo: { contains: 'BATCH_' } },
          { partSerialNo: { contains: 'XYZ' } },
          { partSerialNo: { contains: 'Not Applicable' } },
          { partSerialNo: { equals: '-' } },
        ],
      },
      select: { id: true },
    });

    if (locItems.length > 0) {
      await prisma.locationInventory.updateMany({
        where: {
          id: { in: locItems.map((l) => l.id) },
        },
        data: {
          partSerialNo: '',
        },
      });
      logger.info(`Sanitized ${locItems.length} location inventory records with synthetic serial numbers`);
    }
  } catch (err) {
    logger.error('Error running sanitizeDatabaseSerialNumbers:', err);
  }
}
