import { getStorage } from './storage.js';

// At most 10 storage requests and ~21 D1 queries per invocation. No unbounded fan-out.
// Leases allow overlapping cron/request invocations and recovery after isolate termination.
export async function runCleanup(env, { origin, cache = globalThis.caches?.default } = {}) {
  const deadline = Date.now() + 15000;
  const lease = crypto.randomUUID();
  const { results: jobs } = await env.DB.prepare(`UPDATE image_cleanup
    SET lease = ?, available_at = unixepoch() + 300, attempts = attempts + 1
    WHERE (filename, storage_driver) IN (
      SELECT filename, storage_driver FROM image_cleanup WHERE available_at <= unixepoch()
      ORDER BY available_at LIMIT 10
    ) RETURNING *`).bind(lease).all();
  for (const job of jobs) {
    if (Date.now() > deadline) break; // Unprocessed leases expire; next cron resumes them.
    try {
      const referenced = await env.DB.prepare('SELECT id FROM items WHERE image_url = ? AND image_storage = ? LIMIT 1')
        .bind(job.filename, job.storage_driver).first();
      if (!referenced) {
        await getStorage({ ...env, STORAGE_DRIVER: job.storage_driver }).delete([job.filename]);
        if (origin && cache) {
          await cache.delete(new Request(new URL('/images/' + encodeURIComponent(job.filename), origin))).catch(() => {});
        }
      }
      await env.DB.prepare('DELETE FROM image_cleanup WHERE filename = ? AND storage_driver = ? AND lease = ?')
        .bind(job.filename, job.storage_driver, lease).run();
    } catch (err) {
      // Keep the durable job. Exponential delay capped at one hour, not silent data loss.
      const delay = Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6));
      await env.DB.prepare('UPDATE image_cleanup SET available_at = unixepoch() + ?, lease = NULL WHERE filename = ? AND storage_driver = ? AND lease = ?')
        .bind(delay, job.filename, job.storage_driver, lease).run();
      console.error('Image cleanup will retry', { attempt: job.attempts, reason: err.message });
    }
  }
  return jobs.length;
}

export function scheduleCleanup(c) {
  c.executionCtx.waitUntil(runCleanup(c.env, { origin: c.req.url }).catch(err => console.error('Cleanup deferred to cron', err.message)));
}
