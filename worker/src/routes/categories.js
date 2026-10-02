import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { readJson } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { positiveId, textField } from '../lib/validation.js';
import { scheduleCleanup } from '../lib/cleanup.js';
const categories = new Hono();

categories.get('/service/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw new HTTPException(400, { message: 'Invalid service slug' });
  const { results } = await c.env.DB.prepare(`SELECT c.* FROM categories c JOIN services s ON c.service_id = s.id
    WHERE s.slug = ? ORDER BY c.created_at, c.id`).bind(slug).all();
  return c.json(results);
});

categories.post('/', requireAuth, async (c) => {
  const body = await readJson(c);
  const values = ['name_ar', 'name_en', 'name_he'].map(k => textField(body[k], { required: true }));
  const id = positiveId(body.service_id);
  try {
    const row = await c.env.DB.prepare('INSERT INTO categories(service_id, name_ar, name_en, name_he) VALUES (?, ?, ?, ?) RETURNING *')
      .bind(id, ...values).first();
    return c.json(row, 201);
  } catch (err) {
    if (String(err.message).includes('FOREIGN KEY')) throw new HTTPException(400, { message: 'Service not found' });
    throw err;
  }
});

categories.put('/:id', requireAuth, async (c) => {
  const id = positiveId(c.req.param('id'));
  const body = await readJson(c);
  const values = ['name_ar', 'name_en', 'name_he'].map(k => textField(body[k]));
  if (values.every(v => v === null)) throw new HTTPException(400, { message: 'No fields to update' });
  const row = await c.env.DB.prepare(`UPDATE categories SET name_ar = COALESCE(?, name_ar),
    name_en = COALESCE(?, name_en), name_he = COALESCE(?, name_he) WHERE id = ? RETURNING *`).bind(...values, id).first();
  if (!row) throw new HTTPException(404, { message: 'Category not found' });
  return c.json(row);
});

categories.delete('/:id', requireAuth, async (c) => {
  // FK cascade and image_cleanup triggers execute in the same D1 statement/transaction.
  const result = await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(positiveId(c.req.param('id'))).run();
  if (!result.meta.changes) throw new HTTPException(404, { message: 'Category not found' });
  scheduleCleanup(c);
  return c.json({ success: true });
});
export default categories;
