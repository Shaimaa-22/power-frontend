import { Hono } from 'hono';
import { readJson } from '../lib/http.js';
import { hashPassword } from '../lib/password.js';
import { requireAuth } from '../lib/auth.js';
import { emailAddress, passwordPolicy, positiveId } from '../lib/validation.js';

const admins = new Hono();

// Every route here requires a logged-in admin
admins.use('*', requireAuth);

// GET /api/admins — list admins (never returns password hashes)
admins.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT id, email, created_at FROM admins ORDER BY created_at, id')
    .all();
  return c.json(results);
});

// POST /api/admins   body: { email, password }
admins.post('/', async (c) => {
  const body = await readJson(c);
  const email = emailAddress(body.email);
  const password = passwordPolicy(body.password);

  const passwordHash = await hashPassword(password, c.env.PBKDF2_ITERATIONS);

  try {
    const row = await c.env.DB
      .prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?) RETURNING id, email, created_at')
      .bind(email, passwordHash)
      .first();
    return c.json(row, 201);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return c.json({ error: 'فيه حساب أصلاً بهاد الإيميل' }, 409);
    }
    throw err;
  }
});

// DELETE /api/admins/:id — blocked if it's the last remaining admin
admins.delete('/:id', async (c) => {
  const id = positiveId(c.req.param('id'));

  // Single atomic statement: only deletes when at least 2 admins exist
  const result = await c.env.DB
    .prepare('DELETE FROM admins WHERE id = ? AND (is_active = 0 OR (SELECT COUNT(*) FROM admins WHERE is_active = 1) > 1)')
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    const exists = await c.env.DB.prepare('SELECT id FROM admins WHERE id = ?').bind(id).first();
    if (!exists) return c.json({ error: 'Admin not found' }, 404);
    return c.json({ error: 'ما فيك تحذفي آخر حساب أدمن' }, 400);
  }
  return c.json({ success: true });
});

export default admins;
