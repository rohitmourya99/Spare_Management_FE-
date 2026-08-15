import { google } from 'googleapis';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../config/logger';

export function extractGoogleSheetId(input: string): string {
  if (!input) return '';
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return input.trim();
}

export class GoogleSheetsService {
  private getClient() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !privateKeyRaw) {
      throw new AppError(
        400,
        'Google Service Account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY) are not configured on server.'
      );
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Pull / Import data from client linked Google Sheet into Database
   */
  async importFromSheet(organizationId: string, userId?: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new AppError(404, `Organization '${organizationId}' not found`);
    }

    const sheetId = extractGoogleSheetId(org.googleSheetId || '');
    if (!sheetId) {
      throw new AppError(
        400,
        `No Google Sheet ID configured for organization '${org.name}'. Please update Google Sheet URL in Settings -> Organization Management.`
      );
    }

    const sheets = this.getClient();
    let importedStock = 0;
    let updatedStock = 0;

    try {
      // 1. Pull StockList tab
      const stockRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'StockList!A1:Z2000',
      }).catch(() => null);

      if (stockRes && stockRes.data.values && stockRes.data.values.length > 1) {
        const rows = stockRes.data.values;
        const headers = rows[0].map((h: string) => String(h).trim().toLowerCase());

        // Header indexes
        const idxSpareId = headers.findIndex((h: string) => h.includes('spare id') || h.includes('spareid'));
        const idxName = headers.findIndex((h: string) => h.includes('product') || h.includes('name'));
        const idxPartId = headers.findIndex((h: string) => h.includes('part id') || h.includes('partid'));
        const idxPartCode = headers.findIndex((h: string) => h.includes('part code') || h.includes('partcode'));
        const idxOem = headers.findIndex((h: string) => h.includes('oem'));
        const idxCategory = headers.findIndex((h: string) => h.includes('category'));
        const idxStore = headers.findIndex((h: string) => h.includes('store') || h.includes('warehouse'));
        const idxTotal = headers.findIndex((h: string) => h.includes('total') || h.includes('quantity'));
        const idxSerial = headers.findIndex((h: string) => h.includes('serial'));

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const productName = idxName >= 0 ? String(row[idxName] || '').trim() : '';
          if (!productName) continue;

          const partId = idxPartId >= 0 ? String(row[idxPartId] || '').trim() : `PART-${Date.now()}-${i}`;
          const partCode = idxPartCode >= 0 ? String(row[idxPartCode] || '').trim() : '';
          const oemName = idxOem >= 0 ? String(row[idxOem] || '').trim() : 'General OEM';
          const catName = idxCategory >= 0 ? String(row[idxCategory] || '').trim() : 'General';
          const storeName = idxStore >= 0 ? String(row[idxStore] || '').trim() : 'Main Store';
          const totalQty = idxTotal >= 0 ? parseInt(String(row[idxTotal] || '1')) || 1 : 1;
          const serialNo = idxSerial >= 0 ? String(row[idxSerial] || '').trim() : '';

          // OEM & Category lookup/creation
          let oem = await prisma.oEM.findFirst({ where: { name: { equals: oemName, mode: 'insensitive' } } });
          if (!oem) {
            oem = await prisma.oEM.create({ data: { name: oemName } });
          }

          let category = await prisma.category.findFirst({
            where: { name: { equals: catName, mode: 'insensitive' }, oemId: oem.id },
          });
          if (!category) {
            category = await prisma.category.create({ data: { name: catName, oemId: oem.id } });
          }

          // Check location / store
          let location = await prisma.location.findFirst({
            where: { organizationId, name: { equals: storeName, mode: 'insensitive' } },
          });
          if (!location) {
            location = await prisma.location.create({
              data: { name: storeName, city: storeName, organizationId },
            });
          }

          // Upsert item by partId / serialNumber strictly under organizationId
          const existingItem = await prisma.inventoryItem.findFirst({
            where: {
              organizationId,
              isDeleted: false,
              OR: [
                { partId: { equals: partId } },
                ...(serialNo ? [{ serialNumber: { equals: serialNo } }] : []),
              ],
            },
          });

          if (existingItem) {
            await prisma.inventoryItem.update({
              where: { id: existingItem.id },
              data: {
                productName,
                partCode,
                quantity: totalQty,
                availableQuantity: totalQty,
                store: storeName,
                oemId: oem.id,
                categoryId: category.id,
                locationId: location.id,
              },
            });
            updatedStock++;
          } else {
            const firstUser = await prisma.user.findFirst();
            await prisma.inventoryItem.create({
              data: {
                spareId: `SPARE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                productName,
                partId,
                partCode,
                serialNumber: serialNo || `BATCH-${Date.now()}-${i}`,
                isSerialized: Boolean(serialNo),
                quantity: totalQty,
                availableQuantity: totalQty,
                status: 'AVAILABLE',
                store: storeName,
                oemId: oem.id,
                categoryId: category.id,
                locationId: location.id,
                organizationId,
                createdById: userId || firstUser?.id || 'system',
              },
            });
            importedStock++;
          }
        }
      }

      return {
        success: true,
        message: `Google Sheet pull completed for organization '${org.name}'! (${importedStock} created, ${updatedStock} updated)`,
        importedCount: importedStock,
        updatedCount: updatedStock,
      };
    } catch (err: any) {
      logger.error('Google Sheet import error:', err);
      throw new AppError(500, `Failed to pull Google Sheet data: ${err?.message || 'Google API error'}`);
    }
  }

  /**
   * Push / Export live database records of client organization into their linked Google Sheet
   */
  async exportToSheet(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new AppError(404, `Organization '${organizationId}' not found`);
    }

    const sheetId = extractGoogleSheetId(org.googleSheetId || '');
    if (!sheetId) {
      throw new AppError(
        400,
        `No Google Sheet ID configured for organization '${org.name}'. Please update Google Sheet URL in Settings -> Organization Management.`
      );
    }

    const sheets = this.getClient();

    // Fetch live stock items for organization
    const items = await prisma.inventoryItem.findMany({
      where: { organizationId, isDeleted: false },
      include: { oem: true, category: true, location: true },
      orderBy: { createdAt: 'desc' },
    });

    const headerRow = [
      'Spare ID',
      'Product Name',
      'Part ID',
      'Part Code',
      'OEM',
      'Category',
      'Store',
      'Total Quantity',
      'Available Quantity',
      'Is Serialized',
      'Serial Number',
      'Status',
      'Last Updated',
    ];

    const dataRows = items.map((item) => [
      item.spareId || '',
      item.productName || '',
      item.partId || '',
      item.partCode || '',
      item.oem?.name || '',
      item.category?.name || '',
      item.store || item.location?.name || '',
      item.quantity || 0,
      item.availableQuantity || 0,
      item.isSerialized ? 'YES' : 'NO',
      item.serialNumber || '',
      item.status || 'AVAILABLE',
      item.updatedAt ? new Date(item.updatedAt).toISOString() : '',
    ]);

    const values = [headerRow, ...dataRows];

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'StockList!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });

      return {
        success: true,
        message: `Successfully pushed ${items.length} database stock records to Google Sheet for '${org.name}'!`,
        pushedCount: items.length,
      };
    } catch (err: any) {
      logger.error('Google Sheet export error:', err);
      throw new AppError(500, `Failed to push data to Google Sheet: ${err?.message || 'Google API error'}`);
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
