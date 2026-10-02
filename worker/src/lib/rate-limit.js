import { HTTPException } from 'hono/http-exception';

export async function authRateLimit(c, identity) {
  if (!c.env.AUTH_RATE_LIMITER) throw new HTTPException(503, { message: 'Authentication is not configured' });
  // CF supplies the edge IP. Never trust X-Forwarded-For. Local requests share a bucket.
  const value = identity ? `account:${identity.toLowerCase()}` : `ip:${c.req.header('CF-Connecting-IP') || 'local'}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const { success } = await c.env.AUTH_RATE_LIMITER.limit({ key: `power-auth:${key}` });
  if (!success) {
    c.header('Retry-After', '60');
    throw new HTTPException(429, { message: 'محاولات كثيرة، حاولي مرة أخرى بعد دقيقة' });
  }
}
