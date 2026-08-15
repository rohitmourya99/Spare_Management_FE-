import { prisma } from './database';
import bcrypt from 'bcryptjs';
import { logger } from './logger';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

function getRowValue(row: Record<string, any>, ...possibleKeys: string[]): any {
  const rowKeys = Object.keys(row);
  for (const pKey of possibleKeys) {
    const matchedKey = rowKeys.find((k) => k.trim().toLowerCase() === pKey.trim().toLowerCase());
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return row[matchedKey];
    }
  }
  return null;
}

/**
 * Ensures database tables exist, default users are seeded,
 * and Excel inventory data is automatically imported on server startup.
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  try {
    // 0. Auto-sync PostgreSQL database schema if new tables/columns are missing
    try {
      const { execSync } = require('child_process');
      logger.info('🔄 Verifying and syncing database schema with Prisma...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
      logger.info('✅ Database schema verified & synced.');
    } catch (syncErr) {
      logger.warn('Prisma DB push notice:', syncErr);
    }

    // 1. Seed & Tag Default Organization (BHEL)
    try {
      await prisma.organization.upsert({
        where: { id: 'BHEL' },
        update: { name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
        create: { id: 'BHEL', name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
      });

      await prisma.user.updateMany({ where: { organizationId: null }, data: { organizationId: 'BHEL' } });
      await prisma.inventoryItem.updateMany({ where: { organizationId: null }, data: { organizationId: 'BHEL' } });
      await prisma.location.updateMany({ where: { organizationId: null }, data: { organizationId: 'BHEL' } });
      await prisma.site.updateMany({ where: { organizationId: null }, data: { organizationId: 'BHEL' } });
      await prisma.dispatch.updateMany({ where: { organizationId: null }, data: { organizationId: 'BHEL' } });
      await prisma.pickup.updateMany({ where: { organizationId: null }, data: { organizationId: 'BHEL' } });
      await prisma.activityLog.updateMany({ where: { organizationId: null }, data: { organizationId: 'BHEL' } });
      logger.info('🏢 Default Organization [BHEL] seeded and records tagged.');
    } catch (orgErr) {
      logger.warn('Organization init notice:', orgErr);
    }

    // 1. Ensure Default Users (Admin@123, Inv@123, Eng@123, View@123)
    const hashedAdmin = await bcrypt.hash('Admin@123', 10);
    const hashedInv = await bcrypt.hash('Inv@123', 10);
    const hashedEng = await bcrypt.hash('Eng@123', 10);
    const hashedView = await bcrypt.hash('View@123', 10);

    const superAdmin = await prisma.user.upsert({
      where: { email: 'admin@proactivedata.in' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'admin@proactivedata.in',
        password: hashedAdmin,
        role: 'SUPER_ADMIN',
        phone: '+91-9999999999',
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'inventory@proactivedata.in' },
      update: {},
      create: {
        name: 'Inventory Admin',
        email: 'inventory@proactivedata.in',
        password: hashedInv,
        role: 'INVENTORY_ADMIN',
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'engineer@proactivedata.in' },
      update: {},
      create: {
        name: 'Field Engineer',
        email: 'engineer@proactivedata.in',
        password: hashedEng,
        role: 'ENGINEER',
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'viewer@proactivedata.in' },
      update: {},
      create: {
        name: 'Read Only User',
        email: 'viewer@proactivedata.in',
        password: hashedView,
        role: 'READ_ONLY',
        isActive: true,
      },
    });

    logger.info('✅ Default users verified & ready (Admin@123, Inv@123, Eng@123, View@123)');

    // 2. Check if Inventory Data exists
    const inventoryCount = await prisma.inventoryItem.count();
    if (inventoryCount === 0) {
      logger.info('🌱 Empty database detected. Auto-seeding Excel inventory & site data...');

      const possibleRoots = [
        process.cwd(),
        path.resolve(process.cwd(), '..'),
        path.resolve(__dirname, '../../..'),
        '/opt/render/project/src',
      ];

      const projectRoot = possibleRoots.find((p) => fs.existsSync(path.join(p, 'Delhi Spare_Parts_Inventory.xlsx'))) || process.cwd();
      const delhiExcelPath = path.join(projectRoot, 'Delhi Spare_Parts_Inventory.xlsx');
      const spocExcelPath = path.join(projectRoot, 'SPOC details.xlsx');

      // Import SPOC details
      if (fs.existsSync(spocExcelPath)) {
        logger.info('📄 Reading SPOC details.xlsx...');
        const wb = xlsx.readFile(spocExcelPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const sitesRaw = xlsx.utils.sheet_to_json<any>(sheet);

        for (let i = 0; i < sitesRaw.length; i++) {
          const row = sitesRaw[i];
          const unitDivision = getRowValue(row, 'Unit/ Division', 'Unit Division') || '';
          const subLocation = getRowValue(row, 'Sub-Location/Sub-Unit', 'Sub Location') || '';
          const siteName = subLocation ? `${unitDivision} - ${subLocation}` : unitDivision || `Site ${i + 1}`;
          if (!siteName || siteName.trim() === '') continue;

          await prisma.site.create({
            data: {
              siteName: siteName.trim(),
              unitDivision,
              subLocation,
              locationClass: getRowValue(row, 'Location Class') || '',
              spareStore: getRowValue(row, 'Spare Stores') || '',
              addressLine1: getRowValue(row, 'Address') || '',
              fullAddress: getRowValue(row, 'Address') || '',
              city: getRowValue(row, 'City') || '',
              state: getRowValue(row, 'State') || '',
              contactPerson: getRowValue(row, 'Contact Person Name') || '',
              phone: (getRowValue(row, 'Contact Number', 'Phone') || '').toString(),
              email: getRowValue(row, 'Email') || '',
            },
          });
        }
        logger.info(`✅ Loaded ${sitesRaw.length} BHEL Sites`);
      }

      // Import Delhi Inventory
      if (fs.existsSync(delhiExcelPath)) {
        logger.info('📄 Reading Delhi Spare_Parts_Inventory.xlsx...');
        const wb = xlsx.readFile(delhiExcelPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const inventoryRaw = xlsx.utils.sheet_to_json<any>(sheet);

        let count = 0;
        for (const row of inventoryRaw) {
          const productName = getRowValue(row, 'Spare Item', 'Part Name', 'Product Name');
          const rawOemName = (getRowValue(row, 'OEM', 'Manufacturer') || 'Generic').toString().trim();
          const partCode = (getRowValue(row, 'Spare Part Code', 'Part Code') || '').toString().trim();
          const rawSerial = getRowValue(row, 'Serial Number', 'Serial No', 'S/N', 'Serial Number ');
          const qtyRaw = parseInt(getRowValue(row, 'Quantity', 'Qty') || '1', 10);
          const quantity = isNaN(qtyRaw) ? 1 : qtyRaw;

          if (!productName || productName.toString().trim() === '') continue;

          let oem = await prisma.oEM.findFirst({ where: { name: { equals: rawOemName } } });
          if (!oem) {
            oem = await prisma.oEM.create({ data: { name: rawOemName } });
          }

          let category = await prisma.category.findFirst({ where: { name: 'General', oemId: oem.id } });
          if (!category) {
            category = await prisma.category.create({ data: { name: 'General', oemId: oem.id } });
          }

          count++;
          const spareId = `PDS-DEL-2026-${String(count).padStart(5, '0')}`;
          const cleanSerial = rawSerial ? String(rawSerial).trim() : null;
          const isBatchSerial = cleanSerial ? (
            cleanSerial.toUpperCase().includes('BATCH_') ||
            cleanSerial.toUpperCase().startsWith('_BATCH') ||
            cleanSerial.toUpperCase().startsWith('XYZ') ||
            ['N/A', 'NA', 'NULL', 'UNDEFINED', 'NONE', 'BULK'].includes(cleanSerial.toUpperCase())
          ) : true;
          const isSerialized = !isBatchSerial;

          await prisma.inventoryItem.create({
            data: {
              spareId,
              oemId: oem.id,
              categoryId: category.id,
              productName: productName.toString().trim(),
              partCode,
              serialNumber: isSerialized ? cleanSerial : null,
              isSerialized,
              quantity,
              availableQuantity: quantity,
              unit: 'PCS',
              store: getRowValue(row, 'Warehouse Location', 'Location') || 'Delhi',
              rack: (getRowValue(row, 'Rack', 'Rack No') || '').toString() || null,
              bin: (getRowValue(row, 'Bin', 'Bin No') || '').toString() || null,
              status: 'AVAILABLE',
              createdById: superAdmin.id,
            },
          });
        }
        logger.info(`✅ Successfully loaded ${count} Spare Parts into database`);
      }

      // Cleanup legacy batch placeholder serial numbers in DB for non-serialized items
      await prisma.inventoryItem.updateMany({
        where: {
          OR: [
            { serialNumber: { contains: 'BATCH' } },
            { serialNumber: { startsWith: 'XYZ' } },
          ],
        },
        data: {
          serialNumber: null,
          isSerialized: false,
        },
      }).catch(() => {});

      await prisma.locationInventory.updateMany({
        where: {
          OR: [
            { partSerialNo: { contains: 'BATCH' } },
            { partSerialNo: { startsWith: 'XYZ' } },
          ],
        },
        data: {
          partSerialNo: '',
        },
      }).catch(() => {});

      // Sync ReplacementAuditLog records to SwapHistory if empty
      const swapCount = await prisma.swapHistory.count().catch(() => 0);
      if (swapCount === 0) {
        const auditLogs = await prisma.replacementAuditLog.findMany().catch(() => []);
        for (const log of auditLogs) {
          await prisma.swapHistory.create({
            data: {
              roomId: log.roomId,
              roomName: log.roomName,
              partId: log.partId,
              buildingName: log.buildingName,
              oldSerialNo: log.oldFaultySerialNo,
              newSerialNo: log.newSpareSerialNo,
              swappedBy: log.dispatchedByName || 'System / Technician',
              swapReason: 'Replacement Dispatch Audit',
              swappedAt: log.swapDate,
            },
          }).catch(() => {});
        }
      }
    }
  } catch (error) {
    logger.error('Error during auto database seeding:', error);
  }
}
