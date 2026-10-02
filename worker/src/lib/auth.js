import { sign, verify } from 'hono/jwt';
const SEVEN_DAYS = 7 * 24 * 60 * 60;

export function signToken(env, admin) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ adminId: admin.id, email: admin.email, tokenVersion: admin.token_version,
    iat: now, exp: now + SEVEN_DAYS }, env.JWT_SECRET, 'HS256');
}

export async function requireAuth(c, next) {
  const header = c.req.header('Authorization');
  let payload;
  try {
    if (!header?.startsWith('Bearer ')) throw new Error();
    payload = await verify(header.slice(7), c.env.JWT_SECRET, 'HS256');
    if (!Number.isSafeInteger(payload.adminId) || payload.adminId < 1 ||
        !Number.isSafeInteger(payload.tokenVersion) || payload.tokenVersion < 0 ||
        !Number.isFinite(payload.exp)) throw new Error();
  } catch { return c.json({ error: 'انتهت الجلسة أو التوكن غير صالح' }, 401); }
  // Infrastructure errors must stay 500, not become a misleading 401.
  const admin = await c.env.DB.prepare('SELECT id, email, token_version, is_active FROM admins WHERE id = ?')
    .bind(payload.adminId).first();
  if (!admin || admin.is_active !== 1 || admin.token_version !== payload.tokenVersion) {
    return c.json({ error: 'انتهت الجلسة أو التوكن غير صالح' }, 401);
  }
  c.set('admin', admin);
  c.header('Cache-Control', 'no-store');
  await next();
}
