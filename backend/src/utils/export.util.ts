import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { logger } from '../config/logger';
import { format } from 'date-fns';

/**
 * Export data to Excel file and send as response
 */
export function exportToExcel(
  res: Response,
  data: Record<string, unknown>[],
  sheetName: string,
  filename: string
): void {
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Excel export failed:', error);
    throw error;
  }
}

/**
 * Export data to CSV and send as response
 */
export function exportToCSV(
  res: Response,
  data: Record<string, unknown>[],
  filename: string
): void {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('CSV export failed:', error);
    throw error;
  }
}

/**
 * Export inventory data to PDF
 */
export function exportInventoryToPDF(
  res: Response,
  items: any[],
  title: string,
  filename: string
): void {
  try {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const margin = 40;
    const tableWidth = pageWidth - margin * 2; // ~761.89

    const drawHeader = (pdfDoc: PDFKit.PDFDocument, pageTitle: string) => {
      pdfDoc
        .fontSize(16)
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .text('Proactive Data Systems Pvt. Ltd.', margin, 40, { align: 'center', width: tableWidth });

      pdfDoc
        .fontSize(11)
        .fillColor('#334155')
        .font('Helvetica-Bold')
        .text(pageTitle, margin, 62, { align: 'center', width: tableWidth });

      pdfDoc
        .fontSize(8)
        .fillColor('#64748B')
        .font('Helvetica')
        .text(`Generated: ${format(new Date(), 'dd-MMM-yyyy HH:mm')}`, margin, 78, { align: 'center', width: tableWidth });

      pdfDoc.moveTo(margin, 92).lineTo(margin + tableWidth, 92).strokeColor('#CBD5E1').lineWidth(1).stroke();
    };

    drawHeader(doc, title);

    let currentY = 102;

    if (!items || items.length === 0) {
      doc
        .fontSize(11)
        .fillColor('#475569')
        .font('Helvetica')
        .text('No records found for this report.', margin, currentY + 20, { align: 'center', width: tableWidth });
      doc.end();
      return;
    }

    // Determine headers and row mapper
    let headers: string[] = [];
    let getRowValues: (item: any) => string[] = () => [];

    const firstItem = items[0];
    const keys = Object.keys(firstItem);
    const isRawInventoryItem = 'spareId' in firstItem || 'productName' in firstItem;

    if (!isRawInventoryItem && keys.length > 0) {
      // Formatted report object (e.g. from getReportData)
      headers = keys.slice(0, 10);
      getRowValues = (item: any) => {
        return headers.map((h) => {
          const val = item[h];
          if (val === null || val === undefined) return '-';
          if (val instanceof Date) return format(val, 'dd-MMM-yyyy');
          return String(val);
        });
      };
    } else {
      // Raw InventoryItem
      headers = ['Spare ID', 'OEM', 'Product Name', 'Model', 'Serial No', 'Qty', 'Store / Loc', 'Status', 'Warranty End'];
      getRowValues = (item: any) => [
        item.spareId || item['Spare ID'] || '-',
        item.oem?.name || item.oem || item['OEM'] || '-',
        item.productName || item['Product Name'] || '-',
        item.model || item['Model'] || '-',
        item.serialNumber || item['Serial Number'] || 'N/A',
        String(item.quantity ?? item['Quantity'] ?? item['Qty'] ?? 0),
        item.location?.name || item.location || item.store || item['Store'] || '-',
        item.status || item['Status'] || '-',
        item.warrantyEnd ? format(new Date(item.warrantyEnd), 'dd-MMM-yyyy') : (item['Warranty End'] || '-'),
      ];
    }

    // Calculate column widths
    const colWidth = tableWidth / headers.length;
    const colWidths = headers.map(() => colWidth);

    const drawTableHeader = (startY: number) => {
      let x = margin;
      doc.rect(margin, startY, tableWidth, 20).fillColor('#0F172A').fill();

      headers.forEach((h, i) => {
        doc
          .fontSize(8)
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .text(String(h).toUpperCase(), x + 4, startY + 5, {
            width: colWidths[i] - 8,
            height: 12,
            lineBreak: false,
          });
        x += colWidths[i];
      });
      return startY + 22;
    };

    currentY = drawTableHeader(currentY);

    // Draw rows
    items.forEach((item, index) => {
      if (currentY > 510) {
        doc.addPage();
        drawHeader(doc, title);
        currentY = drawTableHeader(102);
      }

      const rowValues = getRowValues(item);
      let x = margin;

      if (index % 2 === 1) {
        doc.rect(margin, currentY, tableWidth, 18).fillColor('#F8FAFC').fill();
      } else {
        doc.rect(margin, currentY, tableWidth, 18).fillColor('#FFFFFF').fill();
      }

      rowValues.forEach((cell, i) => {
        doc
          .fontSize(7.5)
          .fillColor('#0F172A')
          .font('Helvetica')
          .text(String(cell), x + 4, currentY + 4, {
            width: colWidths[i] - 8,
            height: 12,
            lineBreak: false,
          });
        x += colWidths[i];
      });

      doc.moveTo(margin, currentY + 18).lineTo(margin + tableWidth, currentY + 18).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      currentY += 18;
    });

    // Footer
    doc
      .fontSize(8)
      .fillColor('#64748B')
      .font('Helvetica')
      .text(`Total Records: ${items.length}`, margin, doc.page.height - 35, { width: tableWidth });

    doc.end();
  } catch (error) {
    logger.error('PDF export failed:', error);
    throw error;
  }
}

/**
 * Format inventory data for export
 */
export function formatInventoryForExport(items: any[]): Record<string, unknown>[] {
  return items.map((item) => ({
    'Spare ID': item.spareId,
    OEM: item.oem?.name ?? '',
    Category: item.category?.name ?? '',
    'Product Name': item.productName,
    Description: item.description ?? '',
    Model: item.model ?? '',
    'Part ID': item.partId ?? '',
    'Part Code': item.partCode ?? '',
    'Serial Number': item.serialNumber ?? '',
    Quantity: item.quantity,
    Unit: item.unit,
    Location: item.location?.name ?? '',
    Rack: item.rack ?? '',
    Bin: item.bin ?? '',
    Status: item.status,
    'Warranty Start': item.warrantyStart ? format(new Date(item.warrantyStart), 'dd-MMM-yyyy') : '',
    'Warranty End': item.warrantyEnd ? format(new Date(item.warrantyEnd), 'dd-MMM-yyyy') : '',
    'Purchase Date': item.purchaseDate ? format(new Date(item.purchaseDate), 'dd-MMM-yyyy') : '',
    'Reserved For': item.reservedFor ?? '',
    Remarks: item.remarks ?? '',
    'Created Date': format(new Date(item.createdAt), 'dd-MMM-yyyy HH:mm'),
  }));
}
