import { getStorage } from './storage.js';
import { HTTPException } from 'hono/http-exception';
import { hasImageStructure } from './image-structure.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB, same limit as the old backend

// Only real image types; the extension is derived from the (validated) MIME type.
const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

// Returns an error message (string) or null when the file is fine.
export async function validateImage(file) {
  if (!EXTENSIONS[file.type]) return 'الصورة لازم تكون JPG أو PNG أو WebP أو GIF أو AVIF';
  if (file.size > MAX_IMAGE_BYTES) return 'حجم الصورة أكبر من 5MB';
  // Read the bounded file, not just a prefix: lengths/trailers must match the actual body.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasImageStructure(bytes, file.type)) return 'الصورة تالفة أو غير مكتملة أو لا تطابق النوع المحدد';
  return null;
}

// Uploads and returns the stored filename (what goes in items.image_url).
export async function uploadImage(env, file) {
  const problem = await validateImage(file);
  if (problem) throw new HTTPException(file.size > MAX_IMAGE_BYTES ? 413 : 400, { message: problem });
  const filename = `${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  // Reserve cleanup BEFORE external upload, so crashes and failed DB writes are recoverable.
  await env.DB.prepare('INSERT INTO image_cleanup(filename, storage_driver, available_at) VALUES (?, ?, unixepoch() + 3600)')
    .bind(filename, storageDriver(env)).run();
  await getStorage(env).put(filename, await file.arrayBuffer(), file.type);
  return filename;
}

// Keep the storage choice attached to each image/cleanup job; switching configuration
// must never send an old B2 deletion to an R2 bucket (or vice versa).
export function storageDriver(env) {
  const driver = (env.STORAGE_DRIVER || 'b2').toLowerCase();
  if (!['b2', 'r2'].includes(driver)) throw new Error('Unsupported STORAGE_DRIVER');
  return driver;
}
