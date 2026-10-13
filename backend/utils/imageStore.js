import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { badRequest } from './httpError.js';

// Listing photos arrive as data URLs from the scanner / listing form and are
// written to backend/uploads, served at /uploads/<file>.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 3 * 1024 * 1024;

export const saveDataUrlImage = async (dataUrl) => {
  if (!dataUrl) return null;
  // Already-hosted images (seed data, existing uploads) are kept as-is
  if (typeof dataUrl === 'string' && (/^https:\/\//.test(dataUrl) || dataUrl.startsWith('/uploads/'))) return dataUrl;

  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw badRequest('Image must be a JPEG, PNG or WebP photo');
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > MAX_BYTES) throw badRequest('Image is too large (max 3 MB)');

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${TYPES[m[1]]}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
};
