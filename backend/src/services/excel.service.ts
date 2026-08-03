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
    const summary: ImportSummary = {
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Guard: Validate buffer before SheetJS parsing
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      summary.errors.push({ row: 0, reason: 'No file buffer received. Ensure the file was uploaded correctly.' });
      return summary;
    }

    let rawData: Record<string, any>[] = [];
    try {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName || !workbook.Sheets[sheetName]) {
        summary.errors.push({ row: 1, reason: 'Uploaded Excel sheet is empty or invalid' });
        return summary;
      }
      const sheet = workbook.Sheets[sheetName];
      // Default all blank/empty cells to "XYZ"
      rawData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: 'XYZ' });
    } catch (e: any) {
      summary.errors.push({ row: 1, reason: `Failed to parse Excel file: ${e?.message || 'Invalid format'}` });
      return summary;
    }

    summary.totalRows = rawData.length;
    if (rawData.length === 0) {
      summary.errors.push({ row: 1, reason: 'Uploaded Excel sheet contains 0 data rows' });
      return summary;
    }

    // Dynamic flexible key finder
    const getValue = (row: Record<string, any>, possibleKeys: string[]): string => {
      try {
        const rowKeys = Object.keys(row);
        for (const pk of possibleKeys) {
          const targetClean = pk.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const matchedKey = rowKeys.find((k) => k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === targetClean);
          if (matchedKey && row[matchedKey] !== null && row[matchedKey] !== undefined) {
            const valStr = String(row[matchedKey]).trim();
            if (valStr !== '' && valStr !== 'XYZ') return valStr;
          }
        }
      } catch (e) {
        // Fallback
      }
      return 'XYZ';
    };

    // Resilient non-throwing date parser
    const parseExcelDate = (val: any): Date | null => {
      try {
        if (!val) return null;
        if (val instanceof Date && !isNaN(val.getTime())) return val;
        if (typeof val === 'number') {
          const dateObj = xlsx.SSF.parse_date_code(val);
          if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
            const d = new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d));
            return !isNaN(d.getTime()) ? d : null;
          }
        }
        const str = String(val).trim();
        if (!str || ['XYZ', 'NULL', 'NOT SET', 'UNDEFINED'].includes(str.toUpperCase())) return null;

        // Support DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
        if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) {
          const parts = str.split(/[\/\-\.]/);
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          const d = new Date(Date.UTC(year, month, day));
          return !isNaN(d.getTime()) ? d : null;
        }

        // Support Excel numeric string serial codes (e.g. "45123")
        if (/^\d{4,6}$/.test(str)) {
          const num = parseFloat(str);
          if (!isNaN(num)) {
            const dateObj = xlsx.SSF.parse_date_code(num);
            if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
              const d = new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d));
              return !isNaN(d.getTime()) ? d : null;
            }
          }
        }

        const parsed = new Date(str);
        return !isNaN(parsed.getTime()) ? parsed : null;
      } catch (e) {
        return null;
      }
    };

    // Step 0: Clean up existing '_BATCH_' suffixes in partSerialNo to restore exact serial numbers
    try {
      const batchRecords = await prisma.locationInventory.findMany({
        where: { partSerialNo: { contains: '_BATCH_' } },
      });
      if (batchRecords.length > 0) {
        await Promise.all(
          batchRecords.map((r) => {
            const cleanSerial = r.partSerialNo.split('_BATCH_')[0];
            return prisma.locationInventory.update({
              where: { id: r.id },
              data: { partSerialNo: cleanSerial },
            }).catch(() => null);
          })
        );
      }
    } catch (e) {
      console.warn('Batch serial cleanup warning:', e);
    }

    // Step 1: Sort all raw Excel rows sequentially before processing using strict hierarchy:
    // 1. Unit (Ascending), 2. Sub Unit (Ascending), 3. State (Ascending),
    // 4. Building Name (Ascending), 5. Room Name (Ascending), 6. Room ID (Ascending), 7. Part ID (Ascending)
    rawData.sort((a, b) => {
      const getS = (row: any, keys: string[]) => getValue(row, keys).toLowerCase();

      const unitA = getS(a, ['Unit', 'unit', 'Unit Division']);
      const unitB = getS(b, ['Unit', 'unit', 'Unit Division']);
      if (unitA !== unitB) return unitA.localeCompare(unitB);

      const subA = getS(a, ['Sub Unit', 'subUnit', 'SubUnit', 'sub_unit', 'Sub Location', 'sublocation']);
      const subB = getS(b, ['Sub Unit', 'subUnit', 'SubUnit', 'sub_unit', 'Sub Location', 'sublocation']);
      if (subA !== subB) return subA.localeCompare(subB);

      const stateA = getS(a, ['State', 'state']);
      const stateB = getS(b, ['State', 'state']);
      if (stateA !== stateB) return stateA.localeCompare(stateB);

      const bldgA = getS(a, ['Building Name', 'buildingName', 'BuildingName', 'building_name', 'Building']);
      const bldgB = getS(b, ['Building Name', 'buildingName', 'BuildingName', 'building_name', 'Building']);
      if (bldgA !== bldgB) return bldgA.localeCompare(bldgB);

      const roomNA = getS(a, ['Room Name', 'roomName', 'RoomName', 'room_name', 'Room']);
      const roomNB = getS(b, ['Room Name', 'roomName', 'RoomName', 'room_name', 'Room']);
      if (roomNA !== roomNB) return roomNA.localeCompare(roomNB);

      const rIDA = getS(a, ['Room ID', 'roomId', 'RoomID', 'room_id']);
      const rIDB = getS(b, ['Room ID', 'roomId', 'RoomID', 'room_id']);
      if (rIDA !== rIDB) return rIDA.localeCompare(rIDB);

      const pIDA = getS(a, ['Part ID', 'partId', 'PartID', 'part_id', 'Part Code', 'partCode']);
      const pIDB = getS(b, ['Part ID', 'partId', 'PartID', 'part_id', 'Part Code', 'partCode']);
      return pIDA.localeCompare(pIDB);
    });

    // Step 2: Fetch ALL existing LocationInventory records in ONE lightweight database query
    const allExistingLocItems = await prisma.locationInventory.findMany({
      select: {
        id: true,
        roomId: true,
        partId: true,
        partSerialNo: true,
        status: true,
        oem: true,
        locationClass: true,
        solutionType: true,
        buildingName: true,
        roomName: true,
        floor: true,
        unit: true,
        subUnit: true,
        state: true,
        installationDate: true,
        contractStartDate: true,
        contractEndDate: true,
      },
    }).catch(() => []);

    // Group existing DB records into occurrence map ${roomId}_${partId}_${partSerialNo}_${occurrenceIndex}
    const occurrenceMap = new Map<string, typeof allExistingLocItems[0]>();
    const roomPartOccurrenceCount = new Map<string, number>();
    const serialMap = new Map<string, typeof allExistingLocItems[0]>();

    const matchedDbIds = new Set<string>();

    allExistingLocItems.forEach((item) => {
      const rId = (item.roomId || '').trim().toLowerCase();
      const pId = (item.partId || '').trim().toLowerCase();
      const sNo = (item.partSerialNo || '').trim().toLowerCase();

      const keyBase = `${rId}_${pId}`;
      const count = roomPartOccurrenceCount.get(keyBase) || 0;
      roomPartOccurrenceCount.set(keyBase, count + 1);

      // Key 1: roomId_partId_occurrenceIndex
      occurrenceMap.set(`${keyBase}_${count}`, item);
      // Key 2: roomId_partId_partSerialNo_occurrenceIndex (exclude generic serials like 'xyz')
      if (sNo && !['xyz', 'n/a', 'na', 'null', 'none'].includes(sNo)) {
        occurrenceMap.set(`${keyBase}_${sNo}_${count}`, item);
        if (!serialMap.has(sNo)) {
          serialMap.set(sNo, item);
        }
      }
    });

    // Fetch Replacement Audit Logs to protect app-replaced/dispatched devices
    const replacedSet = new Set<string>();
    try {
      const replacementLogs = await prisma.replacementAuditLog.findMany({
        select: { roomId: true, partId: true, newSpareSerialNo: true, oldFaultySerialNo: true },
      });
      replacementLogs.forEach((log) => {
        if (log.roomId && log.partId) {
          replacedSet.add(`${log.roomId.trim().toLowerCase()}_${log.partId.trim().toLowerCase()}`);
        }
        if (log.newSpareSerialNo) replacedSet.add(log.newSpareSerialNo.trim().toLowerCase());
        if (log.oldFaultySerialNo) replacedSet.add(log.oldFaultySerialNo.trim().toLowerCase());
      });
    } catch (e) {
      console.warn('Replacement logs lookup warning:', e);
    }

    const excelOccurrenceTracker = new Map<string, number>();
    const newRecordsToInsert: Array<Prisma.LocationInventoryCreateInput> = [];
    const updatesToPerform: Array<{ id: string; data: Prisma.LocationInventoryUpdateInput }> = [];

    // Step 3: Iterate sorted Excel rows in memory
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2;

      try {
        const oem = getValue(row, ['OEM', 'oem', 'Manufacturer']);
        const partId = getValue(row, ['Part ID', 'partId', 'PartID', 'part_id', 'Part Code', 'partCode']);
        // Default missing / blank Part Serial No. to 'XYZ'
        const rawSerial = getValue(row, ['Part Serial No.', 'Part Serial No', 'partSerialNo', 'serialNumber', 'Serial No', 'serial_no', 'Serial']);
        const exactSerial = (!rawSerial || rawSerial === 'XYZ') ? 'XYZ' : rawSerial;
        const roomId = getValue(row, ['Room ID', 'roomId', 'RoomID', 'room_id']);
        const locationClass = getValue(row, ['Location Class', 'locationClass', 'LocationClass', 'location_class', 'Class']);
        const solutionType = getValue(row, ['Solution Type', 'solutionType', 'SolutionType', 'solution_type']);
        const buildingName = getValue(row, ['Building Name', 'buildingName', 'BuildingName', 'building_name', 'Building']);
        const roomName = getValue(row, ['Room Name', 'roomName', 'RoomName', 'room_name', 'Room']);
        const floor = getValue(row, ['Floor', 'floor']);
        const unit = getValue(row, ['Unit', 'unit', 'Unit Division']);
        const subUnit = getValue(row, ['Sub Unit', 'subUnit', 'SubUnit', 'sub_unit', 'Sub Location', 'sublocation']);
        const state = getValue(row, ['State', 'state']);

        // Safely parse dates — returns null for missing/blank/invalid without throwing
        const installationDate = parseExcelDate(getValue(row, ['Installation Date', 'installationDate', 'installedDate'])) ?? null;
        const contractStartDate = parseExcelDate(getValue(row, ['Contract Start Date', 'contractStartDate'])) ?? null;
        const contractEndDate = parseExcelDate(getValue(row, ['Contract End Date', 'contractEndDate'])) ?? null;

        const rIdClean = roomId.toLowerCase();
        const pIdClean = partId.toLowerCase();
        const sNoClean = exactSerial.toLowerCase();
        const keyBase = `${rIdClean}_${pIdClean}`;

        const occIndex = excelOccurrenceTracker.get(keyBase) || 0;
        excelOccurrenceTracker.set(keyBase, occIndex + 1);

        // Find candidate existing record without double-matching any single DB row
        let existingRecord: typeof allExistingLocItems[0] | undefined = undefined;

        // Try 1: Exact room + part + serial + occurrence index
        const candidate1 = occurrenceMap.get(`${keyBase}_${sNoClean}_${occIndex}`);
        if (candidate1 && !matchedDbIds.has(candidate1.id)) {
          existingRecord = candidate1;
        }

        // Try 2: Exact room + part + occurrence index
        if (!existingRecord) {
          const candidate2 = occurrenceMap.get(`${keyBase}_${occIndex}`);
          if (candidate2 && !matchedDbIds.has(candidate2.id)) {
            existingRecord = candidate2;
          }
        }

        // Try 3: Unique serial lookup (ONLY for valid non-generic serial numbers)
        if (!existingRecord && sNoClean && !['xyz', 'n/a', 'na', 'null', 'none'].includes(sNoClean)) {
          const candidate3 = serialMap.get(sNoClean);
          if (candidate3 && !matchedDbIds.has(candidate3.id)) {
            existingRecord = candidate3;
          }
        }

        if (existingRecord) {
          matchedDbIds.add(existingRecord.id);
          // Check if this device was replaced or dispatched in app software
          const isReplacedInApp =
            existingRecord.status === 'REPLACED' ||
            existingRecord.status === 'FAULTY' ||
            replacedSet.has(keyBase) ||
            replacedSet.has(existingRecord.partSerialNo.toLowerCase());

          const targetSerial = isReplacedInApp ? existingRecord.partSerialNo : exactSerial;
          const updatePayload: Prisma.LocationInventoryUpdateInput = {
            installationDate: installationDate || existingRecord.installationDate,
            oem: oem || 'XYZ',
            partId: partId || 'XYZ',
            partSerialNo: targetSerial,
            roomId: roomId || 'XYZ',
            locationClass: locationClass || 'XYZ',
            solutionType: solutionType || 'XYZ',
            buildingName: buildingName || 'XYZ',
            roomName: roomName || 'XYZ',
            floor: floor || 'XYZ',
            unit: unit || 'XYZ',
            subUnit: subUnit || 'XYZ',
            state: state || 'XYZ',
            contractStartDate: contractStartDate || existingRecord.contractStartDate,
            contractEndDate: contractEndDate || existingRecord.contractEndDate,
          };

          // Diff-checking: ONLY push to updatesToPerform if data values have actually changed!
          const hasChanged =
            (existingRecord.oem || 'XYZ') !== updatePayload.oem ||
            (existingRecord.partId || 'XYZ') !== updatePayload.partId ||
            (existingRecord.partSerialNo || 'XYZ') !== updatePayload.partSerialNo ||
            (existingRecord.roomId || 'XYZ') !== updatePayload.roomId ||
            (existingRecord.locationClass || 'XYZ') !== updatePayload.locationClass ||
            (existingRecord.solutionType || 'XYZ') !== updatePayload.solutionType ||
            (existingRecord.buildingName || 'XYZ') !== updatePayload.buildingName ||
            (existingRecord.roomName || 'XYZ') !== updatePayload.roomName ||
            (existingRecord.floor || 'XYZ') !== updatePayload.floor ||
            (existingRecord.unit || 'XYZ') !== updatePayload.unit ||
            (existingRecord.subUnit || 'XYZ') !== updatePayload.subUnit ||
            (existingRecord.state || 'XYZ') !== updatePayload.state ||
            (existingRecord.installationDate ? new Date(existingRecord.installationDate).getTime() : null) !== (updatePayload.installationDate ? new Date(updatePayload.installationDate as any).getTime() : null) ||
            (existingRecord.contractStartDate ? new Date(existingRecord.contractStartDate).getTime() : null) !== (updatePayload.contractStartDate ? new Date(updatePayload.contractStartDate as any).getTime() : null) ||
            (existingRecord.contractEndDate ? new Date(existingRecord.contractEndDate).getTime() : null) !== (updatePayload.contractEndDate ? new Date(updatePayload.contractEndDate as any).getTime() : null);

          if (hasChanged) {
            updatesToPerform.push({
              id: existingRecord.id,
              data: updatePayload,
            });
          } else {
            summary.skipped++;
          }
        } else {
          // Case C: New record: Add to bulk insert queue with exact Excel details and "XYZ" for blank cells
          newRecordsToInsert.push({
            installationDate,
            oem: oem || 'XYZ',
            partId: partId || 'XYZ',
            partSerialNo: exactSerial || 'XYZ',
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

    // Step 4: High-performance chunked bulk inserts (500 items per batch)
    if (newRecordsToInsert.length > 0) {
      const CHUNK_SIZE = 500;
      let totalCreated = 0;
      for (let i = 0; i < newRecordsToInsert.length; i += CHUNK_SIZE) {
        const chunk = newRecordsToInsert.slice(i, i + CHUNK_SIZE);
        try {
          const createRes = await prisma.locationInventory.createMany({
            data: chunk,
            skipDuplicates: false,
          });
          totalCreated += createRes.count;
        } catch (err: any) {
          // Fallback item-by-item insert
          for (const item of chunk) {
            try {
              await prisma.locationInventory.create({ data: item });
              totalCreated++;
            } catch (e) {
              summary.failed++;
            }
          }
        }
      }
      summary.imported = totalCreated;
    }

    // Step 5: High-performance parallel updates (all 50-item batches executed concurrently via Promise.all)
    if (updatesToPerform.length > 0) {
      const UPDATE_BATCH_SIZE = 50;
      const batchPromises = [];
      for (let i = 0; i < updatesToPerform.length; i += UPDATE_BATCH_SIZE) {
        const chunk = updatesToPerform.slice(i, i + UPDATE_BATCH_SIZE);
        batchPromises.push(
          Promise.all(
            chunk.map((item) =>
              prisma.locationInventory.update({
                where: { id: item.id },
                data: item.data,
              }).then(() => true).catch((err) => {
                console.warn(`[Excel Upload] Item update error for ID ${item.id}:`, err?.message);
                return false;
              })
            )
          )
        );
      }
      const results = await Promise.all(batchPromises);
      summary.updated = results.flat().filter(Boolean).length;
    }

    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'IMPORT',
          entity: 'LocationInventory',
          entityLabel: `Sequenced Ultra-Fast Location Inventory Upload (${summary.imported} created, ${summary.updated} updated)`,
          newValue: JSON.stringify(summary),
        },
      });
    } catch (e) {
      // Ignore log creation error
    }

    return summary;
  }
}

export const excelService = new ExcelService();
