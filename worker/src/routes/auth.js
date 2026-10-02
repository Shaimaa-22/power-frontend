import { Hono } from 'hono';
import { readJson } from '../lib/http.js';
import { verifyPassword, hashPassword, dummyHash } from '../lib/password.js';
import { signToken, requireAuth } from '../lib/auth.js';
import { emailAddress, passwordPolicy } from '../lib/validation.js';
import { authRateLimit } from '../lib/rate-limit.js';

const auth = new Hono();
auth.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
auth.post('/login', async (c) => {
  await authRateLimit(c);
  const body = await readJson(c);
  const email = emailAddress(body.email);
  const password = passwordPolicy(body.password, { existing: true });
  await authRateLimit(c, email);
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first();
  const valid = await verifyPassword(password, admin?.password_hash || dummyHash(c.env.PBKDF2_ITERATIONS));
  if (!admin || !valid || admin.is_active !== 1) return c.json({ error: 'الإيميل أو الباسورد غير صحيح' }, 401);
  // Upgrade existing hashes on password change/reset, avoiding two KDFs per login.
  return c.json({ token: await signToken(c.env, admin), email: admin.email });
});

auth.post('/password', requireAuth, async (c) => {
  await authRateLimit(c);
  const body = await readJson(c);
  const current = passwordPolicy(body.current_password, { existing: true });
  const password = passwordPolicy(body.new_password);
  const identity = c.get('admin');
  await authRateLimit(c, identity.email);
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(identity.id).first();
  if (!admin || !(await verifyPassword(current, admin.password_hash))) return c.json({ error: 'كلمة المرور الحالية غير صحيحة' }, 403);
  const hash = await hashPassword(password, c.env.PBKDF2_ITERATIONS);
  const result = await c.env.DB.prepare('UPDATE admins SET password_hash = ? WHERE id = ? AND token_version = ? AND is_active = 1')
    .bind(hash, admin.id, identity.token_version).run();
  if (!result.meta.changes) return c.json({ error: 'انتهت الجلسة، سجلي الدخول مجددًا' }, 401);
  // D1 trigger revokes every token, including this one. Client must log in again.
  return c.json({ success: true });
});
export default auth;
