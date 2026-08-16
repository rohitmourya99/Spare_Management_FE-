import { prisma } from '../config/database';
import { patchLegacyOrganizationRecords } from './patchLegacyOrg';

/**
 * Deduplicates non-serialized stock items matching (partCode + store + organizationId),
 * merges quantities into the primary record, re-links all FK relations, and auto-tags legacy records.
 */
export async function deduplicateStockItems(): Promise<{
  groupsEvaluated: number;
  recordsMerged: number;
  deletedDuplicates: number;
}> {
  console.log('🔄 Starting Stock Item Deduplication & Legacy Organization Patch...');

  // 1. Ensure any NULL organizationId is tagged to BHEL first
  await patchLegacyOrganizationRecords();

  let recordsMerged = 0;
  let deletedDuplicates = 0;

  // 2. Fetch all non-deleted, non-serialized inventory items
  const items = await prisma.inventoryItem.findMany({
    where: {
      isDeleted: false,
      isSerialized: false,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Group items by key: partCode (normalized) + store + organizationId
  const groupsMap = new Map<string, typeof items>();

  for (const item of items) {
    const rawPartCode = (item.partCode || item.productName || '').trim().toLowerCase();
    if (!rawPartCode) continue;

    const store = (item.store || 'Delhi').trim();
    const orgId = item.organizationId || 'BHEL';
    const key = `${orgId}::${store}::${rawPartCode}`;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(item);
  }

  const groupsEvaluated = groupsMap.size;

  for (const [key, groupItems] of groupsMap.entries()) {
    if (groupItems.length <= 1) continue;

    // Primary item is the most recently updated item
    const primaryItem = groupItems[0];
    const duplicateItems = groupItems.slice(1);

    // Sum total quantities
    let totalQuantity = primaryItem.quantity;
    let totalAvailableQuantity = primaryItem.availableQuantity;

    for (const dup of duplicateItems) {
      totalQuantity += dup.quantity;
      totalAvailableQuantity += dup.availableQuantity;

      // Re-link foreign key relations to primaryItem
      await prisma.dispatch.updateMany({
        where: { inventoryItemId: dup.id },
        data: { inventoryItemId: primaryItem.id },
      });

      await prisma.pickup.updateMany({
        where: { inventoryItemId: dup.id },
        data: { inventoryItemId: primaryItem.id },
      });

      await prisma.comment.updateMany({
        where: { inventoryItemId: dup.id },
        data: { inventoryItemId: primaryItem.id },
      });

      await prisma.inventoryMovement.updateMany({
        where: { inventoryItemId: dup.id },
        data: { inventoryItemId: primaryItem.id },
      });

      await prisma.rMA.updateMany({
        where: { inventoryItemId: dup.id },
        data: { inventoryItemId: primaryItem.id },
      });

      await prisma.reservation.updateMany({
        where: { inventoryItemId: dup.id },
        data: { inventoryItemId: primaryItem.id },
      });

      // Safely delete duplicate record
      try {
        await prisma.inventoryItem.delete({
          where: { id: dup.id },
        });
        deletedDuplicates++;
      } catch (err) {
        // Soft delete fallback if hard delete is restricted
        await prisma.inventoryItem.update({
          where: { id: dup.id },
          data: { isDeleted: true, quantity: 0, availableQuantity: 0 },
        });
        deletedDuplicates++;
      }
    }

    // Update primary item with merged stock quantities
    await prisma.inventoryItem.update({
      where: { id: primaryItem.id },
      data: {
        quantity: totalQuantity,
        availableQuantity: totalAvailableQuantity,
        organizationId: primaryItem.organizationId || 'BHEL',
      },
    });

    recordsMerged++;
  }

  console.log(`✅ Deduplication Completed: Evaluated ${groupsEvaluated} groups, merged ${recordsMerged} duplicate groups, deleted ${deletedDuplicates} duplicate records.`);

  return {
    groupsEvaluated,
    recordsMerged,
    deletedDuplicates,
  };
}

// Standalone execution entrypoint when run directly via tsx / ts-node
if (require.main === module) {
  deduplicateStockItems()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Deduplication failed:', err);
      process.exit(1);
    });
}
