const MAX_BYTES = 1024 * 1024;

const parseUploadToBase64 = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const dataUrlMatch = raw.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (dataUrlMatch) {
    const base64 = dataUrlMatch[2];
    const bytes = Buffer.byteLength(base64, 'base64');
    if (bytes > MAX_BYTES) throw new Error('Stamp image is too large (max 1 MB)');
    return base64;
  }

  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 32) {
    const bytes = Buffer.byteLength(raw, 'base64');
    if (bytes > MAX_BYTES) throw new Error('Stamp image is too large (max 1 MB)');
    return raw;
  }

  throw new Error('Stamp must be a PNG or JPEG image');
};

export const processStampUpload = (input) => {
  if (input === undefined) return undefined;
  if (input === null || input === '') return '';
  return parseUploadToBase64(input);
};

export const stampBase64ToDataUri = (base64) => {
  const cleaned = String(base64 || '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('data:')) return cleaned;
  return `data:image/png;base64,${cleaned}`;
};
