import QRCode from 'qrcode';
import { logger } from '../config/logger';

/**
 * Generate a QR code as base64 data URL
 */
export async function generateQRCode(data: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
      width: 200,
    });
    return qrDataUrl;
  } catch (error) {
    logger.error('QR code generation failed:', error);
    return '';
  }
}

/**
 * Generate a QR code as SVG string
 */
export async function generateQRCodeSVG(data: string): Promise<string> {
  try {
    return await QRCode.toString(data, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
    });
  } catch (error) {
    logger.error('QR SVG generation failed:', error);
    return '';
  }
}
