import { Hono } from 'hono';
import { getStorage } from '../lib/storage.js';
import { conditionalStatus } from '../lib/conditional.js';
const images = new Hono();

images.get('/:filename', async (c) => {
  const key = c.req.param('filename');
  if (!key || key.length > 255 || /[\/\\\x00-\x1f]/.test(key) || key === '.' || key === '..') return c.text('Image not found', 404);
  // Normalize the pathname and strip query parameters. Updated images always have new UUIDs.
  const cacheKey = new Request(new URL('/images/' + encodeURIComponent(key), c.req.url));
  const cache = caches.default;
  let response = await cache.match(cacheKey);
  if (!response) {
    const object = await getStorage(c.env).get(key);
    if (!object) return c.text('Image not found', 404);
    const headers = new Headers(object.headers);
    // Bound stale content after deletes without building a distributed purge system.
    headers.set('Cache-Control', 'public, max-age=300, must-revalidate');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (!headers.get('content-type')) headers.set('content-type', 'application/octet-stream');
    response = new Response(object.body, { headers });
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()).catch(err => console.error('Image cache write failed', err.message)));
  }
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=300, must-revalidate');
  const status = conditionalStatus(c.req.raw.headers, headers);
  if (status !== 200) {
    // Do not await cancellation of a tee branch while Cache API consumes the other branch.
    c.executionCtx.waitUntil(response.body?.cancel().catch(() => {}) || Promise.resolve());
    headers.delete('content-length');
    return new Response(null, { status, headers });
  }
  return new Response(response.body, { headers });
});
export default images;
