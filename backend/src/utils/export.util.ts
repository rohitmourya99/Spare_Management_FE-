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

    // Header
    doc
      .fontSize(18)
      .fillColor('#1e293b')
      .text('Proactive Data Systems Pvt. Ltd.', { align: 'center' });

    doc
      .fontSize(13)
      .fillColor('#334155')
      .text(title, { align: 'center' });

    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text(`Generated: ${format(new Date(), 'dd-MMM-yyyy HH:mm')}`, { align: 'center' });

    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(800, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.5);

    // Table header
    const headers = ['Spare ID', 'OEM', 'Product', 'Model', 'Serial No', 'Qty', 'Location', 'Status', 'Warranty End'];
    const colWidths = [80, 70, 140, 90, 90, 35, 80, 70, 80];
    let x = 40;
    const headerY = doc.y;

    headers.forEach((h, i) => {
      doc
        .fontSize(8)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text(h, x, headerY, { width: colWidths[i] });
      x += colWidths[i];
    });

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(800, doc.y).strokeColor('#cbd5e1').stroke();

    // Table rows
    items.slice(0, 100).forEach((item, index) => {
      if (doc.y > 520) doc.addPage();
      const rowY = doc.y + 4;
      x = 40;

      if (index % 2 === 0) {
        doc.rect(40, rowY - 2, 760, 14).fillColor('#f8fafc').fill();
      }

      const row = [
        item.spareId ?? '',
        item.oem?.name ?? '',
        item.productName ?? '',
        item.model ?? '',
        item.serialNumber ?? '-',
        String(item.quantity ?? 0),
        item.location?.name ?? '',
        item.status ?? '',
        item.warrantyEnd ? format(new Date(item.warrantyEnd), 'dd-MMM-yyyy') : '-',
      ];

      row.forEach((cell, i) => {
        doc
          .fontSize(7)
          .fillColor('#374151')
          .font('Helvetica')
          .text(String(cell).substring(0, 25), x, rowY, { width: colWidths[i] });
        x += colWidths[i];
      });

      doc.moveDown(0.1);
    });

    // Footer
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(`Total Records: ${items.length}`, 40, doc.page.height - 40);

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
