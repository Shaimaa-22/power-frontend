import { HTTPException } from 'hono/http-exception';

export const MAX_JSON_BYTES = 32 * 1024;
export const MAX_UPLOAD_BODY_BYTES = 5 * 1024 * 1024 + 512 * 1024;

// Bound actual bytes before parsing, including chunked/dishonest Content-Length requests.
export async function readLimitedBody(request, limit) {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await request.body?.cancel().catch(() => {});
    throw new HTTPException(413, { message: 'Request body is too large' });
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => {});
        throw new HTTPException(413, { message: 'Request body is too large' });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readJson(c) {
  if (!(c.req.header('content-type') || '').toLowerCase().startsWith('application/json')) {
    throw new HTTPException(415, { message: 'Expected application/json' });
  }
  const bytes = await readLimitedBody(c.req.raw, MAX_JSON_BYTES);
  try {
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new HTTPException(400, { message: 'Malformed JSON body' }); }
}

export async function readFields(c) {
  const type = c.req.header('content-type') || '';
  if (type.toLowerCase().startsWith('application/json')) return { fields: await readJson(c), file: null };
  if (!/^multipart\/form-data\b|^application\/x-www-form-urlencoded\b/i.test(type)) {
    throw new HTTPException(415, { message: 'Expected JSON or form data' });
  }
  const bytes = await readLimitedBody(c.req.raw, MAX_UPLOAD_BODY_BYTES);
  let body;
  try { body = await new Response(bytes, { headers: { 'content-type': type } }).formData(); }
  catch { throw new HTTPException(400, { message: 'Malformed form data' }); }
  const fields = Object.create(null);
  let file = null;
  const seen = new Set();
  for (const [key, value] of body) {
    if (seen.has(key)) throw new HTTPException(400, { message: 'Duplicate form field' });
    seen.add(key);
    if (typeof value === 'string') fields[key] = value;
    else if (key === 'image') file = value.size ? value : null;
    else throw new HTTPException(400, { message: 'Unexpected file field' });
  }
  return { fields, file };
}
