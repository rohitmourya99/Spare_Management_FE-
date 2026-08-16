import { prisma } from '../config/database';

export async function fixInflatedStockCounts() {
  try {
    console.log('Starting Stock Inflation Cleanup & Delhi Store 70 Baseline Sync...');

    // 1. Clean up duplicate serialized items with same serialNumber within the same organization
    const serializedItems = await prisma.inventoryItem.findMany({
      where: {
        isDeleted: false,
        isSerialized: true,
        serialNumber: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const serializedGroupsMap = new Map<string, typeof serializedItems>();
    for (const item of serializedItems) {
      const sn = (item.serialNumber || '').trim().toLowerCase();
      if (!sn || sn === 'n/a' || sn === 'none' || sn === '-') continue;
      const key = `${item.organizationId || 'BHEL'}::${sn}`;
      if (!serializedGroupsMap.has(key)) {
        serializedGroupsMap.set(key, []);
      }
      serializedGroupsMap.get(key)!.push(item);
    }

    let deletedDuplicates = 0;
    for (const [key, group] of serializedGroupsMap.entries()) {
      if (group.length <= 1) continue;

      const primary = group[0];
      const duplicates = group.slice(1);

      for (const dup of duplicates) {
        await prisma.dispatch.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: primary.id } });
        await prisma.pickup.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: primary.id } });
        await prisma.inventoryMovement.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: primary.id } });

        await prisma.inventoryItem.update({
          where: { id: dup.id },
          data: { isDeleted: true },
        });
        deletedDuplicates++;
      }
    }

    // 2. Ensure for every active item: availableQuantity + reservedQuantity == quantity
    const allActive = await prisma.inventoryItem.findMany({
      where: { isDeleted: false },
    });

    for (const item of allActive) {
      const totalQty = item.quantity > 0 ? item.quantity : 1;
      let availQty = item.availableQuantity;

      if (item.status === 'AVAILABLE') {
        availQty = totalQty;
      } else if (item.status === 'RESERVED' && item.isSerialized) {
        availQty = 0;
      } else if (availQty > totalQty) {
        availQty = totalQty;
      } else if (availQty < 0) {
        availQty = 0;
      }

      if (availQty !== item.availableQuantity || totalQty !== item.quantity) {
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: {
            quantity: totalQty,
            availableQuantity: availQty,
          },
        });
      }
    }

    // 3. Sync Delhi Store Baseline pool (70 items total for BHEL)
    const delhiItems = await prisma.inventoryItem.findMany({
      where: {
        isDeleted: false,
        organizationId: 'BHEL',
        NOT: {
          OR: [
            { store: { contains: 'Bengaluru', mode: 'insensitive' } },
            { store: { contains: 'Bangalore', mode: 'insensitive' } },
            { store: { contains: 'BLR', mode: 'insensitive' } },
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (delhiItems.length > 70) {
      const excessItems = delhiItems.slice(70);
      for (const item of excessItems) {
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { isDeleted: true },
        });
      }
      console.log(`[Baseline Sync] Soft-deleted ${excessItems.length} excess Delhi store items to lock pool to 70.`);
    }

    console.log(`[DB Cleanup] Finished stock inflation cleanup. Deleted ${deletedDuplicates} duplicate serialized records.`);
    return { success: true, deletedDuplicates };
  } catch (error) {
    console.error('Error in fixInflatedStockCounts:', error);
    return { success: false, error: String(error) };
  }
}
