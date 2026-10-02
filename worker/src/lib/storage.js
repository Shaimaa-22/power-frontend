import { AwsClient } from 'aws4fetch';

// One tiny interface over both image stores, chosen by the STORAGE_DRIVER variable:
//   put(key, arrayBuffer, contentType)
//   get(key, requestHeaders) -> null | { status: 200|304, body, headers }
//   delete(keys[])
export function getStorage(env) {
  const driver = (env.STORAGE_DRIVER || 'b2').toLowerCase();
  if (!['b2', 'r2'].includes(driver)) throw new Error('Unsupported STORAGE_DRIVER');
  return driver === 'r2' ? r2Storage(env) : b2Storage(env);
}

// ---------------- Cloudflare R2 (native binding) ----------------
function r2Storage(env) {
  const bucket = env.IMAGES;
  if (!bucket) {
    throw new Error('STORAGE_DRIVER is "r2" but the IMAGES R2 binding is missing in wrangler.jsonc');
  }
  return {
    async put(key, data, contentType) {
      await bucket.put(key, data, { httpMetadata: { contentType } });
    },
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      headers.set('last-modified', obj.uploaded.toUTCString());
      headers.set('content-length', String(obj.size));
      return { status: 200, body: obj.body, headers };
    },
    async delete(keys) {
      for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
    },
  };
}

// ---------------- Backblaze B2 (S3-compatible API, signed with aws4fetch) ----------------
function b2Storage(env) {
  const { B2_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT, B2_REGION, B2_BUCKET_NAME } = env;
  if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_ENDPOINT || !B2_REGION || !B2_BUCKET_NAME) {
    throw new Error('Backblaze B2 settings are incomplete (B2_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT, B2_REGION, B2_BUCKET_NAME)');
  }
  const aws = new AwsClient({
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
    service: 's3',
    region: B2_REGION,
    retries: 0, // Durable cleanup handles retries; do not multiply subrequests invisibly.
  });
  const origin = (B2_ENDPOINT.startsWith('http') ? B2_ENDPOINT : `https://${B2_ENDPOINT}`).replace(/\/+$/, '');
  const endpoint = new URL(origin);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('B2_ENDPOINT must be an HTTPS origin');
  }
  const urlFor = (key) => `${origin}/${B2_BUCKET_NAME}/${encodeURIComponent(key)}`;

  return {
    async put(key, data, contentType) {
      const res = await aws.fetch(urlFor(key), {
        method: 'PUT',
        body: data,
        headers: { 'Content-Type': contentType },
        signal: AbortSignal.timeout(20000),
      });
      await res.body?.cancel();
      if (!res.ok) throw new Error(`B2 upload failed with status ${res.status}`);
    },
    async get(key) {
      const res = await aws.fetch(urlFor(key), { method: 'GET', signal: AbortSignal.timeout(20000) });
      if (res.status === 404) { await res.body?.cancel(); return null; }
      if (!res.ok) { await res.body?.cancel(); throw new Error(`B2 download failed with status ${res.status}`); }
      const headers = new Headers();
      for (const name of ['content-type', 'content-length', 'etag', 'last-modified']) {
        const value = res.headers.get(name);
        if (value) headers.set(name, value);
      }
      return { status: 200, body: res.body, headers };
    },
    async delete(keys) {
      if (keys.length > 10) throw new Error('Use the durable cleanup batch (maximum 10 B2 deletes per invocation)');
      for (const key of keys) {
        const res = await aws.fetch(urlFor(key), { method: 'DELETE', signal: AbortSignal.timeout(10000) });
        await res.body?.cancel();
        if (!res.ok && res.status !== 404) throw new Error(`B2 delete failed with status ${res.status}`);
      }
    },
  };
}
