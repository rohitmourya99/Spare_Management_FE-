import xlsx from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { generateQRCode } from '../utils/qrcode.util';
import { logger } from '../config/logger';

export interface ImportSummary {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}

export class ExcelService {
  /**
   * Import Inventory from Excel file (.xlsx, .xls)
   */
  async importInventory(
    fileBuffer: Buffer,
    store: 'Delhi' | 'Bengaluru',
    userId: string
  ): Promise<ImportSummary> {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

    const summary: ImportSummary = {
      totalRows: rawData.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    let count = await prisma.inventoryItem.count();

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2; // Accounting for 1-based index + header row

      try {
        // Extract fields matching Excel headers flexibly
        const getVal = (row: Record<string, any>, ...keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const found = rowKeys.find((rk) => rk.trim().toLowerCase() === k.trim().toLowerCase());
            if (found && row[found] !== undefined && row[found] !== null) return row[found];
          }
          return null;
        };

        const productName = getVal(row, 'Spare Item', 'Part Name', 'Product Name', 'Description');
        const oemName = (getVal(row, 'OEM', 'Manufacturer') || 'Generic').toString().trim();
        const partCode = (getVal(row, 'Spare Part Code', 'Part Code', 'Part Number') || '').toString().trim();
        const serialNumber = getVal(row, 'Serial Number', 'Serial No', 'S/N', 'Serial Number ');
        const qtyRaw = parseInt(getVal(row, 'Quantity', 'Qty') || '1', 10);
        const quantity = isNaN(qtyRaw) || qtyRaw < 1 ? 1 : qtyRaw;
        const locationName = getVal(row, 'Warehouse Location', 'Location') || store;
        const description = getVal(row, 'Description', 'Remarks') || productName;
        const model = getVal(row, 'Model') || partCode;

        if (!productName || productName.toString().trim() === '') {
          summary.skipped++;
          continue;
        }

        // Upsert OEM case-insensitively
        let oem = await prisma.oEM.findFirst({
          where: { name: { equals: oemName } },
        });
        if (!oem) {
          oem = await prisma.oEM.create({ data: { name: oemName } });
        }

        // Upsert Category
        let category = await prisma.category.findFirst({
          where: { name: 'General', oemId: oem.id },
        });
        if (!category) {
          category = await prisma.category.create({
            data: { name: 'General', oemId: oem.id },
          });
        }

        // Upsert Location if available
        let location = await prisma.location.findFirst({
          where: { name: { contains: store } },
        });
        if (!location) {
          location = await prisma.location.findFirst();
        }

        const isSerialized = Boolean(serialNumber && serialNumber.toString().trim() !== '');
        const cleanSerial = isSerialized ? serialNumber.toString().trim() : null;

        // Check if item already exists by Serial Number or Part Code + Product Name + Store
        let existingItem = null;
        if (cleanSerial) {
          existingItem = await prisma.inventoryItem.findUnique({
            where: { serialNumber: cleanSerial },
          });
        } else if (partCode) {
          existingItem = await prisma.inventoryItem.findFirst({
            where: {
              productName: productName.toString().trim(),
              partCode,
              store,
              isDeleted: false,
            },
          });
        }

        if (existingItem) {
          // Update existing item stock
          const newQty = existingItem.quantity + quantity;
          const newAvail = existingItem.availableQuantity + quantity;

          await prisma.inventoryItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: newQty,
              availableQuantity: newAvail,
              updatedById: userId,
            },
          });

          await prisma.inventoryMovement.create({
            data: {
              inventoryItemId: existingItem.id,
              type: 'IMPORT',
              quantity,
              previousStock: existingItem.availableQuantity,
              newStock: newAvail,
              performedById: userId,
              remarks: `Excel import quantity addition (${store})`,
            },
          });

          summary.updated++;
        } else {
          // Create new spare item
          count++;
          const prefix = store === 'Bengaluru' ? 'PDS-BLR' : 'PDS-DEL';
          const spareId = `${prefix}-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
          const qrCode = await generateQRCode(spareId);

          const newItem = await prisma.inventoryItem.create({
            data: {
              spareId,
              oemId: oem.id,
              categoryId: category.id,
              productName: productName.toString().trim(),
              description: description ? description.toString().trim() : null,
              model: model ? model.toString().trim() : null,
              partCode,
              serialNumber: cleanSerial,
              isSerialized,
              quantity,
              availableQuantity: quantity,
              unit: 'PCS',
              store,
              locationId: location ? location.id : null,
              status: 'AVAILABLE',
              qrCode,
              createdById: userId,
            },
          });

          await prisma.inventoryMovement.create({
            data: {
              inventoryItemId: newItem.id,
              type: 'IMPORT',
              quantity,
              previousStock: 0,
              newStock: quantity,
              performedById: userId,
              remarks: `Excel import initial stock (${store})`,
            },
          });

          summary.imported++;
        }
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({ row: rowNum, reason: err.message || 'Validation error' });
      }
    }

    // Log Activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'IMPORT',
        entity: 'Inventory',
        entityLabel: `${store} Store Excel Import (${summary.imported} imported, ${summary.updated} updated)`,
        newValue: JSON.stringify(summary),
      },
    });

    return summary;
  }

  /**
   * Import BHEL Sites from SPOC Excel file
   */
  async importSites(fileBuffer: Buffer, userId: string): Promise<ImportSummary> {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

    const summary: ImportSummary = {
      totalRows: rawData.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2;

      try {
        const unitDivision = row['Unit/ Division'] || '';
        const subLocation = row['Sub-Location/Sub-Unit'] || '';
        const siteName = subLocation
          ? `${unitDivision} - ${subLocation}`
          : unitDivision || `Site ${i + 1}`;
        const locationClass = row['Location Class'] || '';
        const spareStore = row['Spare Stores'] || '';
        const address = row['Address'] || '';
        const city = row['City'] || '';
        const state = row['State'] || '';
        const contactPerson = row['Contact Person Name'] || '';
        const phone = (row['Contact Number'] || row['Phone'] || '').toString();
        const email = row['Email'] || '';

        if (!siteName || siteName.trim() === '') {
          summary.skipped++;
          continue;
        }

        const existingSite = await prisma.site.findFirst({
          where: {
            OR: [{ siteName: siteName.trim() }, { fullAddress: address.trim() }],
          },
        });

        if (existingSite) {
          await prisma.site.update({
            where: { id: existingSite.id },
            data: {
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
          summary.updated++;
        } else {
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
          summary.imported++;
        }
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({ row: rowNum, reason: err.message || 'Import error' });
      }
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'IMPORT',
        entity: 'SiteMaster',
        entityLabel: `BHEL SPOC Site Master Excel Import (${summary.imported} imported, ${summary.updated} updated)`,
        newValue: JSON.stringify(summary),
      },
    });

    return summary;
  }

  /**
   * Import Location Inventory from 15-field Excel specification with row-level validation
   */
  async importLocationInventory(fileBuffer: Buffer, userId: string): Promise<ImportSummary> {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Default all blank/empty cells to "XYZ"
    const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: 'XYZ' });

    const requiredHeaders = [
      'Installation Date',
      'OEM',
      'Part ID',
      'Part Serial No.',
      'Room ID',
      'Location Class',
      'Solution Type',
      'Building Name',
      'Room Name',
      'Floor',
      'Unit',
      'Sub Unit',
      'State',
      'Contract Start Date',
      'Contract End Date',
    ];

    const summary: ImportSummary = {
      totalRows: rawData.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    if (rawData.length === 0) {
      summary.errors.push({ row: 1, reason: 'Uploaded Excel sheet is empty' });
      return summary;
    }

    // Header validation
    const firstRowKeys = Object.keys(rawData[0]).map((k) => k.trim());
    const missingHeaders: string[] = [];

    for (const reqH of requiredHeaders) {
      const found = firstRowKeys.some((k) => k.toLowerCase() === reqH.toLowerCase());
      if (!found) {
        missingHeaders.push(reqH);
      }
    }

    if (missingHeaders.length > 0) {
      summary.errors.push({
        row: 1,
        reason: `Missing required column header(s): ${missingHeaders.join(', ')}`,
      });
      summary.failed = rawData.length;
      return summary;
    }

    const getVal = (row: Record<string, any>, key: string): string => {
      const keys = Object.keys(row);
      const matchedKey = keys.find((k) => k.trim().toLowerCase() === key.trim().toLowerCase());
      const val = matchedKey ? row[matchedKey] : 'XYZ';
      if (val === null || val === undefined) return 'XYZ';
      const str = String(val).trim();
      return str === '' ? 'XYZ' : str;
    };

    const parseExcelDate = (val: any): Date | null => {
      if (!val || val === 'XYZ') return null;
      if (val instanceof Date && !isNaN(val.getTime())) return val;
      if (typeof val === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(val);
        if (dateObj) return new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d));
      }
      const str = String(val).trim();
      if (!str || str === 'XYZ') return null;

      // Support DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) {
        const parts = str.split(/[\/\-\.]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }

      // Support Excel numeric string serial codes (e.g. "45123")
      if (/^\d{4,6}$/.test(str)) {
        const num = parseFloat(str);
        if (!isNaN(num)) {
          const dateObj = xlsx.SSF.parse_date_code(num);
          if (dateObj) return new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d));
        }
      }

      const parsed = new Date(str);
      return !isNaN(parsed.getTime()) ? parsed : null;
    };

    // 1. Clean up existing duplicate rows in LocationInventory (keeping latest per roomId + partId)
    const allLocInventories = await prisma.locationInventory.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    const seenRoomPartDedupe = new Map<string, string>();
    const duplicateIdsToDelete: string[] = [];

    for (const item of allLocInventories) {
      const key = `${(item.roomId || '').trim().toLowerCase()}_${(item.partId || '').trim().toLowerCase()}`;
      if (seenRoomPartDedupe.has(key)) {
        duplicateIdsToDelete.push(item.id);
      } else {
        seenRoomPartDedupe.set(key, item.id);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < duplicateIdsToDelete.length; i += CHUNK_SIZE) {
        const chunk = duplicateIdsToDelete.slice(i, i + CHUNK_SIZE);
        await prisma.locationInventory.deleteMany({
          where: { id: { in: chunk } },
        });
      }
    }

    // 2. Fetch Replacement Audit Logs to protect app-replaced/dispatched devices
    const replacementLogs = await prisma.replacementAuditLog.findMany({
      select: { roomId: true, partId: true, newSpareSerialNo: true, oldFaultySerialNo: true },
    });
    const replacedSet = new Set<string>();
    replacementLogs.forEach((log) => {
      replacedSet.add(`${log.roomId.trim().toLowerCase()}_${log.partId.trim().toLowerCase()}`);
      if (log.newSpareSerialNo) replacedSet.add(log.newSpareSerialNo.trim().toLowerCase());
      if (log.oldFaultySerialNo) replacedSet.add(log.oldFaultySerialNo.trim().toLowerCase());
    });

    // 3. Fetch remaining LocationInventory records after cleanup
    const currentLocItems = await prisma.locationInventory.findMany();
    const roomPartMap = new Map<string, typeof currentLocItems[0]>();
    const serialMap = new Map<string, typeof currentLocItems[0]>();
    const allExistingSerials = new Set<string>();

    currentLocItems.forEach((item) => {
      const key = `${(item.roomId || '').trim().toLowerCase()}_${(item.partId || '').trim().toLowerCase()}`;
      if (!roomPartMap.has(key)) {
        roomPartMap.set(key, item);
      }
      if (item.partSerialNo) {
        serialMap.set(item.partSerialNo.trim().toLowerCase(), item);
        allExistingSerials.add(item.partSerialNo.trim().toLowerCase());
      }
    });

    const batchId = Date.now();
    const seenInBatch = new Set<string>();
    const recordsToCreate: Array<Prisma.LocationInventoryCreateInput> = [];
    const updatesToPerform: Array<{ id: string; data: Prisma.LocationInventoryUpdateInput }> = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2;

      try {
        const oem = getVal(row, 'OEM');
        const partId = getVal(row, 'Part ID');
        let rawSerial = getVal(row, 'Part Serial No.');
        if (rawSerial === 'XYZ') rawSerial = getVal(row, 'Part Serial No');
        if (rawSerial === 'XYZ') rawSerial = getVal(row, 'Serial No');
        if (rawSerial === 'XYZ') rawSerial = `SN-XYZ-${i + 1}`;

        const roomId = getVal(row, 'Room ID');
        const locationClass = getVal(row, 'Location Class');
        const solutionType = getVal(row, 'Solution Type');
        const buildingName = getVal(row, 'Building Name');
        const roomName = getVal(row, 'Room Name');
        const floor = getVal(row, 'Floor');
        const unit = getVal(row, 'Unit');
        let subUnit = getVal(row, 'Sub Unit');
        if (subUnit === 'XYZ') subUnit = getVal(row, 'SubUnit');
        if (subUnit === 'XYZ') subUnit = getVal(row, 'Sub Location');
        const state = getVal(row, 'State');

        const installationDate = parseExcelDate(getVal(row, 'Installation Date'));
        const contractStartDate = parseExcelDate(getVal(row, 'Contract Start Date'));
        const contractEndDate = parseExcelDate(getVal(row, 'Contract End Date'));

        const roomPartKey = `${roomId.toLowerCase()}_${partId.toLowerCase()}`;
        const existingRecord = roomPartMap.get(roomPartKey) || serialMap.get(rawSerial.toLowerCase());

        if (existingRecord) {
          // Check if this device was replaced or dispatched in app
          const isReplacedInApp =
            existingRecord.status === 'REPLACED' ||
            existingRecord.status === 'FAULTY' ||
            replacedSet.has(roomPartKey) ||
            replacedSet.has(existingRecord.partSerialNo.toLowerCase());

          if (isReplacedInApp) {
            // CRITICAL: DO NOT overwrite partSerialNo for app-replaced devices! Keep active software serial.
            updatesToPerform.push({
              id: existingRecord.id,
              data: {
                installationDate: installationDate || existingRecord.installationDate,
                oem,
                partId,
                roomId,
                locationClass,
                solutionType,
                buildingName,
                roomName,
                floor,
                unit,
                subUnit,
                state,
                contractStartDate: contractStartDate || existingRecord.contractStartDate,
                contractEndDate: contractEndDate || existingRecord.contractEndDate,
              },
            });
          } else {
            // UNTOUCHED: Update location fields AND partSerialNo
            let serialToSet = existingRecord.partSerialNo;
            if (rawSerial !== 'XYZ' && rawSerial.toLowerCase() !== existingRecord.partSerialNo.toLowerCase()) {
              if (!allExistingSerials.has(rawSerial.toLowerCase())) {
                serialToSet = rawSerial;
                allExistingSerials.add(rawSerial.toLowerCase());
              }
            }
            updatesToPerform.push({
              id: existingRecord.id,
              data: {
                installationDate: installationDate || existingRecord.installationDate,
                oem,
                partId,
                partSerialNo: serialToSet,
                roomId,
                locationClass,
                solutionType,
                buildingName,
                roomName,
                floor,
                unit,
                subUnit,
                state,
                contractStartDate: contractStartDate || existingRecord.contractStartDate,
                contractEndDate: contractEndDate || existingRecord.contractEndDate,
              },
            });
          }
        } else {
          // DOES NOT EXIST: Insert as new InstalledInventory record
          let finalSerial = rawSerial;
          const lowerSerial = rawSerial.toLowerCase();
          if (allExistingSerials.has(lowerSerial) || seenInBatch.has(lowerSerial)) {
            finalSerial = `${rawSerial}_BATCH_${batchId}_${i + 1}`;
          }

          seenInBatch.add(lowerSerial);
          allExistingSerials.add(finalSerial.toLowerCase());

          recordsToCreate.push({
            installationDate,
            oem: oem || 'XYZ',
            partId: partId || 'XYZ',
            partSerialNo: finalSerial,
            roomId: roomId || 'XYZ',
            locationClass: locationClass || 'XYZ',
            solutionType: solutionType || 'XYZ',
            buildingName: buildingName || 'XYZ',
            roomName: roomName || 'XYZ',
            floor: floor || 'XYZ',
            unit: unit || 'XYZ',
            subUnit: subUnit || 'XYZ',
            state: state || 'XYZ',
            contractStartDate,
            contractEndDate,
            status: 'INSTALLED',
          });
        }
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({
          row: rowNum,
          reason: err.message || `Error processing Row ${rowNum}`,
        });
      }
    }

    // High-Speed Batch Create using createMany with chunk size of 500
    if (recordsToCreate.length > 0) {
      const CHUNK_SIZE = 500;
      let totalCreated = 0;
      for (let i = 0; i < recordsToCreate.length; i += CHUNK_SIZE) {
        const chunk = recordsToCreate.slice(i, i + CHUNK_SIZE);
        const createRes = await prisma.locationInventory.createMany({
          data: chunk,
          skipDuplicates: false,
        });
        totalCreated += createRes.count;
      }
      summary.imported = totalCreated;
    }

    // Fast Transaction Updates
    if (updatesToPerform.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < updatesToPerform.length; i += BATCH_SIZE) {
        const batch = updatesToPerform.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(
          batch.map((u) => prisma.locationInventory.update({ where: { id: u.id }, data: u.data }))
        );
      }
      summary.updated = updatesToPerform.length;
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'IMPORT',
        entity: 'LocationInventory',
        entityLabel: `Smart Location Inventory Import (${summary.imported} created, ${summary.updated} updated)`,
        newValue: JSON.stringify(summary),
      },
    });

    return summary;
  }
}

export const excelService = new ExcelService();
