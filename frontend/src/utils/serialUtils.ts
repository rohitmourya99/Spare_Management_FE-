/**
 * Helper utilities for serial number validation and display formatting.
 * Non-serialized/bulk items or batch placeholders (e.g. _BATCH_1785766517435_1518, BATCH_..., XYZ...)
 * should be identified and hidden/formatted appropriately so invalid batch IDs are never exposed.
 */

export const isRealSerial = (sn?: string | null): boolean => {
  if (!sn) return false;
  const s = String(sn).trim();
  if (!s) return false;

  const upper = s.toUpperCase();
  if (
    upper.includes('BATCH_') ||
    upper.startsWith('_BATCH') ||
    upper.startsWith('BATCH') ||
    upper.startsWith('XYZ') ||
    upper === 'N/A' ||
    upper === 'NA' ||
    upper === 'NULL' ||
    upper === 'UNDEFINED' ||
    upper === 'NONE' ||
    upper === 'BULK'
  ) {
    return false;
  }
  return true;
};

export const formatSerialDisplay = (sn?: string | null, fallback = ''): string => {
  if (!isRealSerial(sn)) return fallback;
  return String(sn).trim();
};
