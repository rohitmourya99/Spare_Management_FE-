import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Helper to get row value ignoring trailing/leading spaces in column headers
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

async function main() {
  console.log('🌱 Wiping existing data & performing clean seed with exact Excel serial numbers...');

  // 1. Wipe transactional and master data
  await prisma.comment.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.pickup.deleteMany();
  await prisma.rMA.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.oEM.deleteMany();
  await prisma.site.deleteMany();
  console.log('🧹 Cleaned existing database records.');

  // 2. Users
  const hashedAdmin = await bcrypt.hash('Admin@123', 10);
  const hashedInv = await bcrypt.hash('Inv@123', 10);
  const hashedEng = await bcrypt.hash('Eng@123', 10);
  const hashedView = await bcrypt.hash('View@123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@proactivedata.in' },
    update: { password: hashedAdmin },
    create: {
      name: 'Super Admin',
      email: 'admin@proactivedata.in',
      password: hashedAdmin,
      role: 'SUPER_ADMIN',
      phone: '+91-9999999999',
    },
  });

  await prisma.user.upsert({
    where: { email: 'inventory@proactivedata.in' },
    update: { password: hashedInv },
    create: {
      name: 'Inventory Admin',
      email: 'inventory@proactivedata.in',
      password: hashedInv,
      role: 'INVENTORY_ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'engineer@proactivedata.in' },
    update: { password: hashedEng },
    create: {
      name: 'Field Engineer',
      email: 'engineer@proactivedata.in',
      password: hashedEng,
      role: 'ENGINEER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@proactivedata.in' },
    update: { password: hashedView },
    create: {
      name: 'Read Only User',
      email: 'viewer@proactivedata.in',
      password: hashedView,
      role: 'READ_ONLY',
    },
  });

  console.log('✅ Users created successfully.');

  // 3. File Paths
  const projectRoot = path.resolve(__dirname, '../..');
  const delhiExcelPath = path.join(projectRoot, 'Delhi Spare_Parts_Inventory.xlsx');
  const spocExcelPath = path.join(projectRoot, 'SPOC details.xlsx');

  // 4. Import BHEL SPOC Sites
  if (fs.existsSync(spocExcelPath)) {
    console.log('📄 Importing SPOC details.xlsx...');
    const wb = xlsx.readFile(spocExcelPath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const sitesRaw = xlsx.utils.sheet_to_json<any>(sheet);

    for (let i = 0; i < sitesRaw.length; i++) {
      const row = sitesRaw[i];
      const unitDivision = getRowValue(row, 'Unit/ Division', 'Unit Division') || '';
      const subLocation = getRowValue(row, 'Sub-Location/Sub-Unit', 'Sub Location') || '';
      const siteName = subLocation ? `${unitDivision} - ${subLocation}` : unitDivision || `Site ${i + 1}`;
      const locationClass = getRowValue(row, 'Location Class') || '';
      const spareStore = getRowValue(row, 'Spare Stores') || '';
      const address = getRowValue(row, 'Address') || '';
      const city = getRowValue(row, 'City') || '';
      const state = getRowValue(row, 'State') || '';
      const contactPerson = getRowValue(row, 'Contact Person Name') || '';
      const phone = (getRowValue(row, 'Contact Number', 'Phone') || '').toString();
      const email = getRowValue(row, 'Email') || '';

      if (!siteName || siteName.trim() === '') continue;

      await prisma.site.create({
        data: {
          siteName: siteName.trim(),
          unitDivision,
          subLocation,
          locationClass,
          spareStore,
          addressLine1: address,
          fullAddress: address,
          city,
          state,
          contactPerson,
          phone,
          email,
        },
      });
    }
    console.log(`✅ Loaded ${sitesRaw.length} BHEL Sites from SPOC details.xlsx`);
  }

  // 5. Import Delhi Spare Inventory Excel
  if (fs.existsSync(delhiExcelPath)) {
    console.log('📄 Importing Delhi Spare_Parts_Inventory.xlsx...');
    const wb = xlsx.readFile(delhiExcelPath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const inventoryRaw = xlsx.utils.sheet_to_json<any>(sheet);

    let count = 0;
    let serializedCount = 0;
    let nonSerializedCount = 0;

    for (const row of inventoryRaw) {
      const productName = getRowValue(row, 'Spare Item', 'Part Name', 'Product Name');
      const rawOemName = (getRowValue(row, 'OEM', 'Manufacturer') || 'Generic').toString().trim();
      const partCode = (getRowValue(row, 'Spare Part Code', 'Part Code') || '').toString().trim();
      const rawSerial = getRowValue(row, 'Serial Number', 'Serial No', 'S/N', 'Serial Number ');
      const qtyRaw = parseInt(getRowValue(row, 'Quantity', 'Qty') || '1', 10);
      const quantity = isNaN(qtyRaw) ? 1 : qtyRaw;
      const store = getRowValue(row, 'Warehouse Location', 'Location') || 'Delhi';
      const rack = getRowValue(row, 'Rack', 'Rack No');
      const bin = getRowValue(row, 'Bin', 'Bin No');

      if (!productName || productName.toString().trim() === '') continue;

      let oem = await prisma.oEM.findFirst({
        where: { name: { equals: rawOemName } },
      });
      if (!oem) {
        oem = await prisma.oEM.create({ data: { name: rawOemName } });
      }

      let category = await prisma.category.findFirst({
        where: { name: 'General', oemId: oem.id },
      });
      if (!category) {
        category = await prisma.category.create({
          data: { name: 'General', oemId: oem.id },
        });
      }

      count++;
      const spareId = `PDS-DEL-2026-${String(count).padStart(5, '0')}`;

      const cleanSerial = rawSerial ? String(rawSerial).trim() : null;
      const isSerialized = Boolean(cleanSerial && cleanSerial !== 'null' && cleanSerial !== 'undefined' && cleanSerial !== '');

      if (isSerialized) {
        serializedCount++;
      } else {
        nonSerializedCount++;
      }

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
          store,
          rack: rack ? rack.toString() : null,
          bin: bin ? bin.toString() : null,
          status: 'AVAILABLE',
          createdById: superAdmin.id,
        },
      });
    }

    console.log(`✅ Loaded ${count} Spare Parts from Excel`);
    console.log(`   - Serialized Devices with EXACT Excel Serials: ${serializedCount}`);
    console.log(`   - Non-Serialized Items: ${nonSerializedCount}`);
  }

  const items = await prisma.inventoryItem.findMany({
    where: { isSerialized: true },
    select: { spareId: true, productName: true, partCode: true, serialNumber: true },
  });
  console.log('\n--- VERIFYING EXACT SERIAL NUMBERS FROM EXCEL ---');
  items.forEach(i => console.log(`${i.spareId} | ${i.partCode} | SN: ${i.serialNumber} | ${i.productName}`));

  console.log('\n🎉 Clean seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
