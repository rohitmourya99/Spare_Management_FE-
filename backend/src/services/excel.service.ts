import xlsx from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { generateQRCode } from '../utils/qrcode.util';
import { AppError } from '../middleware/error.middleware';
import { activityService } from './activity.service';
import { logger } from '../config/logger';
import { isBatchOrDummySerial } from '../utils/export.util';
import { buildOrgFilter } from '../utils/orgFilter.util';

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  skippedDetails: Array<{ row: number; reason: string }>;
  failedDetails: Array<{ row: number; reason: string }>;
  errors: Array<{ row: number; reason: string }>;
}

export class ExcelService {
  /**
   * Import Inventory from Excel file (.xlsx, .xls)
   */
  async importInventory(
    fileBuffer: Buffer,
    store: 'Delhi' | 'Bengaluru',
    userId: string,
    organizationId: string = 'BHEL'
  ): Promise<ImportSummary> {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

    const targetOrgId = organizationId || 'BHEL';

    const summary: ImportSummary = {
      totalRows: rawData.length,
      validRows: rawData.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      skippedDetails: [],
      failedDetails: [],
      errors: [],
    };

    if (rawData.length === 0) return summary;

    // STEP 1: Purge / Wipe existing inventory items for the active organizationId
    await prisma.inventoryItem.deleteMany({
      where: {
        OR: [
          { organizationId: targetOrgId },
          ...(targetOrgId === 'BHEL' ? [{ organizationId: null }] : []),
        ],
      },
    });

    // STEP 2: Pre-fetch & Cache OEMs, Categories, and Location
    const allOems = await prisma.oEM.findMany();
    const oemCache = new Map<string, string>();
    for (const o of allOems) {
      oemCache.set(o.name.trim().toLowerCase(), o.id);
    }

    const allCategories = await prisma.category.findMany();
    const categoryCache = new Map<string, string>();
    for (const c of allCategories) {
      if (!categoryCache.has(c.oemId)) {
        categoryCache.set(c.oemId, c.id);
      }
    }

    let defaultLocation = await prisma.location.findFirst({
      where: { name: { contains: store } },
    });
    if (!defaultLocation) {
      defaultLocation = await prisma.location.findFirst();
    }

    const getVal = (row: Record<string, any>, ...keys: string[]) => {
      const rowKeys = Object.keys(row);
      for (const k of keys) {
        const found = rowKeys.find((rk) => rk.trim().toLowerCase() === k.trim().toLowerCase());
        if (found && row[found] !== undefined && row[found] !== null) return row[found];
      }
      return null;
    };

    const getOemId = async (oemName: string): Promise<string> => {
      const cleanName = oemName.trim().toLowerCase();
      if (oemCache.has(cleanName)) {
        return oemCache.get(cleanName)!;
      }
      const newOem = await prisma.oEM.create({ data: { name: oemName } });
      oemCache.set(cleanName, newOem.id);
      return newOem.id;
    };

    const getCategoryId = async (oemId: string): Promise<string> => {
      if (categoryCache.has(oemId)) {
        return categoryCache.get(oemId)!;
      }
      const newCat = await prisma.category.create({ data: { name: 'General', oemId } });
      categoryCache.set(oemId, newCat.id);
      return newCat.id;
    };

    const insertsToPerform: Array<{
      spareId: string;
      oemId: string;
      categoryId: string;
      productName: string;
      description?: string | null;
      model?: string | null;
      partCode: string;
      serialNumber: string | null;
      isSerialized: boolean;
      quantity: number;
      availableQuantity: number;
      unit: string;
      store: string;
      organizationId: string;
      locationId: string | null;
      status: string;
      qrCode: string;
      createdById: string;
    }> = [];

    let startCount = await prisma.inventoryItem.count();
    const prefix = store === 'Bengaluru' ? 'PDS-BLR' : 'PDS-DEL';
    const year = new Date().getFullYear();

    const cleanStr = (val: any) => (val !== undefined && val !== null ? String(val).trim() : '');

    // STEP 3: In-Memory Row Processing & Flexible Column Extraction
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2;

      try {
        const productName = cleanStr(getVal(row, 'Spare Item', 'Part Name', 'Product Name', 'Description', 'Item Name'));
        const oemRaw = cleanStr(getVal(row, 'OEM', 'Manufacturer'));
        const partCode = cleanStr(getVal(row, 'Spare Part Code', 'Part Code', 'Part Number', 'Item Code', 'Part ID'));
        const locationName = cleanStr(getVal(row, 'Warehouse Location', 'Location', 'Store Location', 'Building Name', 'Building'));
        
        // Flexible Serial Number column mapping
        const serialNumberRaw = getVal(
          row,
          'PART SERIAL NO.',
          'PART SERIAL NO',
          'Part Serial Number',
          'Serial Number',
          'Serial No',
          'S/N',
          'Serial Number ',
          'Serial',
          'Part Serial No'
        );
        const cleanSerialRaw = cleanStr(serialNumberRaw);

        // Row Validation: Skip if all essential fields are empty/whitespace
        if (!productName && !partCode && !locationName && !cleanSerialRaw && (!oemRaw || oemRaw.toLowerCase() === 'generic')) {
          summary.skipped++;
          continue;
        }

        // Must have at least a product name or part code to be valid
        if (!productName && !partCode) {
          summary.skipped++;
          continue;
        }

        const oemName = oemRaw || 'Generic';
        const finalProductName = productName || partCode;
        const qtyRaw = parseInt(getVal(row, 'Quantity', 'Qty') || '1', 10);
        const quantity = isNaN(qtyRaw) || qtyRaw < 1 ? 1 : qtyRaw;
        const description = cleanStr(getVal(row, 'Description', 'Remarks')) || finalProductName;
        const model = cleanStr(getVal(row, 'Model')) || partCode;

        const isNotSerial = isBatchOrDummySerial(serialNumberRaw);
        const cleanSerial = !isNotSerial && cleanSerialRaw !== '' ? cleanSerialRaw : null;
        const isSerialized = Boolean(cleanSerial);

        const oemId = await getOemId(oemName);
        const categoryId = await getCategoryId(oemId);

        startCount++;
        const spareId = `${prefix}-${year}-${String(startCount).padStart(5, '0')}`;
        const qrCode = await generateQRCode(spareId);

        insertsToPerform.push({
          spareId,
          oemId,
          categoryId,
          productName: finalProductName,
          description: description || null,
          model: model || null,
          partCode,
          serialNumber: cleanSerial,
          isSerialized,
          quantity,
          availableQuantity: quantity,
          unit: 'PCS',
          store,
          organizationId: targetOrgId,
          locationId: defaultLocation ? defaultLocation.id : null,
          status: 'AVAILABLE',
          qrCode,
          createdById: userId,
        });

        summary.imported++;
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({ row: rowNum, reason: err.message || 'Validation error' });
      }
    }

    // STEP 4: Execute Bulk Inserts in Chunks (500 rows per chunk)
    if (insertsToPerform.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < insertsToPerform.length; i += CHUNK_SIZE) {
        const chunk = insertsToPerform.slice(i, i + CHUNK_SIZE);
        await prisma.inventoryItem.createMany({
          data: chunk,
          skipDuplicates: true,
        });

        // Batch movement logging
        const insertedItems = await prisma.inventoryItem.findMany({
          where: { spareId: { in: chunk.map((c) => c.spareId) } },
          select: { id: true, quantity: true },
        });

        if (insertedItems.length > 0) {
          await prisma.inventoryMovement.createMany({
            data: insertedItems.map((item) => ({
              inventoryItemId: item.id,
              type: 'IMPORT',
              quantity: item.quantity,
              previousStock: 0,
              newStock: item.quantity,
              performedById: userId,
              remarks: `Fresh Excel import stock (${store})`,
            })),
          });
        }
      }
    }

    // Log Activity
    await prisma.activityLog.create({
      data: {
        userId,
        organizationId: targetOrgId,
        action: 'IMPORT',
        entity: 'Inventory',
        entityLabel: `${store} Store Fresh Excel Import (${summary.imported} items imported after purge)`,
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
      validRows: rawData.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      skippedDetails: [],
      failedDetails: [],
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
      validRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      skippedDetails: [],
      failedDetails: [],
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

    // Filter out completely empty rows
    const nonBlankRows = rawData.filter((row) => {
      const values = Object.values(row).map((v) => String(v).trim());
      return values.some((v) => v !== '' && v !== 'XYZ');
    });

    summary.validRows = nonBlankRows.length > 0 ? nonBlankRows.length : rawData.length;
    const processRows = nonBlankRows.length > 0 ? nonBlankRows : rawData;

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

        if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) {
          const parts = str.split(/[\/\-\.]/);
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          const d = new Date(Date.UTC(year, month, day));
          return !isNaN(d.getTime()) ? d : null;
        }

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

    // Step 1: Sort all processable Excel rows sequentially
    processRows.sort((a, b) => {
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

    const occurrenceMap = new Map<string, typeof allExistingLocItems[0]>();
    const roomPartOccurrenceCount = new Map<string, number>();
    const serialMap = new Map<string, typeof allExistingLocItems[0]>();
    const existingSerialSet = new Set<string>();
    const matchedDbIds = new Set<string>();

    allExistingLocItems.forEach((item) => {
      const rId = (item.roomId || '').trim().toLowerCase();
      const pId = (item.partId || '').trim().toLowerCase();
      const sNo = (item.partSerialNo || '').trim().toLowerCase();

      if (sNo) {
        existingSerialSet.add(sNo);
      }

      const keyBase = `${rId}_${pId}`;
      const count = roomPartOccurrenceCount.get(keyBase) || 0;
      roomPartOccurrenceCount.set(keyBase, count + 1);

      occurrenceMap.set(`${keyBase}_${count}`, item);
      if (sNo && !['xyz', 'n/a', 'na', 'null', 'none'].includes(sNo)) {
        occurrenceMap.set(`${keyBase}_${sNo}_${count}`, item);
        if (!serialMap.has(sNo)) {
          serialMap.set(sNo, item);
        }
      }
    });

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
    } catch (e) {}

    const excelOccurrenceTracker = new Map<string, number>();
    const newRecordsToInsert: Array<Prisma.LocationInventoryCreateInput> = [];
    const updatesToPerform: Array<{ id: string; data: Prisma.LocationInventoryUpdateInput }> = [];

    // Step 3: Iterate sorted Excel rows
    for (let i = 0; i < processRows.length; i++) {
      const row = processRows[i];
      const rowNum = i + 2;

      try {
        const oem = getValue(row, ['OEM', 'oem', 'Manufacturer']);
        const partId = getValue(row, ['Part ID', 'partId', 'PartID', 'part_id', 'Part Code', 'partCode']);
        const rawSerial = getValue(row, ['Part Serial No.', 'Part Serial No', 'partSerialNo', 'serialNumber', 'Serial No', 'serial_no', 'Serial']);
        const exactSerial = isBatchOrDummySerial(rawSerial) ? '' : rawSerial.toString().trim();
        const roomId = getValue(row, ['Room ID', 'roomId', 'RoomID', 'room_id']);
        const locationClass = getValue(row, ['Location Class', 'locationClass', 'LocationClass', 'location_class', 'Class']);
        const solutionType = getValue(row, ['Solution Type', 'solutionType', 'SolutionType', 'solution_type']);
        const buildingName = getValue(row, ['Building Name', 'buildingName', 'BuildingName', 'building_name', 'Building']);
        const roomName = getValue(row, ['Room Name', 'roomName', 'RoomName', 'room_name', 'Room']);
        const floor = getValue(row, ['Floor', 'floor']);
        const unit = getValue(row, ['Unit', 'unit', 'Unit Division']);
        const subUnit = getValue(row, ['Sub Unit', 'subUnit', 'SubUnit', 'sub_unit', 'Sub Location', 'sublocation']);
        const state = getValue(row, ['State', 'state']);

        const installationDate = parseExcelDate(getValue(row, ['Installation Date', 'installationDate', 'installedDate'])) ?? null;
        const contractStartDate = parseExcelDate(getValue(row, ['Contract Start Date', 'contractStartDate'])) ?? null;
        const contractEndDate = parseExcelDate(getValue(row, ['Contract End Date', 'contractEndDate'])) ?? null;

        const rIdClean = roomId.toLowerCase();
        const pIdClean = partId.toLowerCase();
        const sNoClean = exactSerial.toLowerCase();
        const keyBase = `${rIdClean}_${pIdClean}`;

        const occIndex = excelOccurrenceTracker.get(keyBase) || 0;
        excelOccurrenceTracker.set(keyBase, occIndex + 1);

        let existingRecord: typeof allExistingLocItems[0] | undefined = undefined;
        const candidate1 = occurrenceMap.get(`${keyBase}_${sNoClean}_${occIndex}`);
        if (candidate1 && !matchedDbIds.has(candidate1.id)) existingRecord = candidate1;
        if (!existingRecord) {
          const candidate2 = occurrenceMap.get(`${keyBase}_${occIndex}`);
          if (candidate2 && !matchedDbIds.has(candidate2.id)) existingRecord = candidate2;
        }
        if (!existingRecord && sNoClean && !['xyz', 'n/a', 'na', 'null', 'none'].includes(sNoClean)) {
          const candidate3 = serialMap.get(sNoClean);
          if (candidate3 && !matchedDbIds.has(candidate3.id)) existingRecord = candidate3;
        }

        if (existingRecord) {
          matchedDbIds.add(existingRecord.id);
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
            updatesToPerform.push({ id: existingRecord.id, data: updatePayload });
          } else {
            summary.skipped++;
            summary.skippedDetails.push({
              row: rowNum,
              reason: `Row ${rowNum} (${buildingName} - ${roomName} / ${partId}): Unchanged, record in DB is up-to-date.`,
            });
          }
        } else {
          let finalSerial = isBatchOrDummySerial(exactSerial) ? '' : exactSerial;
          if (finalSerial) {
            existingSerialSet.add(finalSerial.toLowerCase());
          }

          newRecordsToInsert.push({
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
        summary.failedDetails.push({
          row: rowNum,
          reason: `Row ${rowNum} processing error: ${err.message || 'Unknown row error'}`,
        });
      }
    }

    // Step 4: Bulk inserts
    if (newRecordsToInsert.length > 0) {
      const CHUNK_SIZE = 500;
      let totalCreated = 0;
      for (let i = 0; i < newRecordsToInsert.length; i += CHUNK_SIZE) {
        const chunk = newRecordsToInsert.slice(i, i + CHUNK_SIZE);
        try {
          const createRes = await prisma.locationInventory.createMany({
            data: chunk,
          });
          totalCreated += createRes.count;
        } catch (err: any) {
          for (const item of chunk) {
            try {
              await prisma.locationInventory.create({ data: item });
              totalCreated++;
            } catch (e: any) {
              summary.failed++;
              summary.failedDetails.push({
                row: 0,
                reason: `DB insert error for ${item.partId} (${item.buildingName}): ${e?.message || 'Unique constraint error'}`,
              });
            }
          }
        }
      }
      summary.imported = totalCreated;
    }

    // Step 5: Parallel updates
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
                summary.failed++;
                summary.failedDetails.push({
                  row: 0,
                  reason: `Update error for DB ID ${item.id}: ${err?.message}`,
                });
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
      await activityService.logActivity({
        userId,
        module: 'Import',
        action: 'Inventory Excel Imported',
        entity: 'LocationInventory',
        entityLabel: `15-Field Location Inventory Upload`,
        remarks: `Total: ${summary.totalRows} rows (${summary.imported} imported, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed)`,
      });
    } catch (e) {}

    return summary;
  }
}

export const excelService = new ExcelService();
