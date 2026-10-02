import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { readFields } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { uploadImage, storageDriver } from '../lib/images.js';
import { positiveId, textField } from '../lib/validation.js';
import { scheduleCleanup } from '../lib/cleanup.js';

const items = new Hono();
function fields(f, required) {
  return [textField(f.title_ar, { required }), textField(f.title_en, { required }), textField(f.title_he, { required }),
    textField(f.description_ar, { max: 5000, empty: true }), textField(f.description_en, { max: 5000, empty: true }),
    textField(f.description_he, { max: 5000, empty: true })];
}
// The reservation cannot be attached after a cleaner has claimed it.
const reservation = `EXISTS (SELECT 1 FROM image_cleanup WHERE filename = ? AND storage_driver = ?
  AND lease IS NULL AND attempts = 0 AND available_at > unixepoch())`;
function finishUpload(env, filename, driver) {
  return env.DB.prepare(`DELETE FROM image_cleanup WHERE filename = ? AND storage_driver = ?
    AND EXISTS (SELECT 1 FROM items WHERE image_url = ? AND image_storage = ?)`)
    .bind(filename, driver, filename, driver);
}
async function failedUpload(c, filename, driver) {
  if (filename) await c.env.DB.prepare('UPDATE image_cleanup SET available_at = unixepoch() WHERE filename = ? AND storage_driver = ? AND lease IS NULL')
    .bind(filename, driver).run();
  scheduleCleanup(c);
}

items.get('/category/:categoryId', async (c) => {
  const id = positiveId(c.req.param('categoryId'));
  const { results } = await c.env.DB.prepare('SELECT * FROM items WHERE category_id = ? ORDER BY created_at DESC, id DESC').bind(id).all();
  return c.json(results);
});

items.post('/', requireAuth, async (c) => {
  const { fields: f, file } = await readFields(c);
  const categoryId = positiveId(f.category_id);
  const values = fields(f, true);
  if (!(await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(categoryId).first())) {
    throw new HTTPException(400, { message: 'Category not found' });
  }
  const driver = storageDriver(c.env);
  const filename = file ? await uploadImage(c.env, file) : null;
  try {
    const statement = c.env.DB.prepare(`INSERT INTO items
      (category_id, title_ar, title_en, title_he, description_ar, description_en, description_he, image_url, image_storage)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ? IS NULL OR ${reservation} RETURNING *`)
      .bind(categoryId, ...values, filename, driver, filename, filename, driver);
    const statements = [statement];
    if (filename) statements.push(finishUpload(c.env, filename, driver));
    const [result] = await c.env.DB.batch(statements);
    const row = result.results[0];
    if (!row) throw new HTTPException(409, { message: 'Upload expired; retry saving the item' });
    scheduleCleanup(c);
    return c.json(row, 201);
  } catch (err) {
    await failedUpload(c, filename, driver);
    if (String(err.message).includes('FOREIGN KEY')) throw new HTTPException(409, { message: 'Category changed; reload and try again' });
    throw err;
  }
});

items.put('/:id', requireAuth, async (c) => {
  const id = positiveId(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT version FROM items WHERE id = ?').bind(id).first();
  if (!existing) throw new HTTPException(404, { message: 'Item not found' });
  const { fields: f, file } = await readFields(c);
  const values = fields(f, false);
  if (!file && values.every(v => v === null)) throw new HTTPException(400, { message: 'No fields to update' });
  let version = existing.version;
  if (f.version !== undefined) {
    if (!/^\d+$/.test(String(f.version)) || !Number.isSafeInteger(Number(f.version))) throw new HTTPException(400, { message: 'Invalid version' });
    version = Number(f.version);
  }
  if (version !== existing.version) throw new HTTPException(409, { message: 'Item changed; reload before editing' });
  const driver = storageDriver(c.env);
  const filename = file ? await uploadImage(c.env, file) : null;
  try {
    const update = c.env.DB.prepare(`UPDATE items SET
      title_ar = COALESCE(?, title_ar), title_en = COALESCE(?, title_en), title_he = COALESCE(?, title_he),
      description_ar = COALESCE(?, description_ar), description_en = COALESCE(?, description_en), description_he = COALESCE(?, description_he),
      image_url = COALESCE(?, image_url), image_storage = CASE WHEN ? IS NULL THEN image_storage ELSE ? END, version = version + 1
      WHERE id = ? AND version = ? AND (? IS NULL OR ${reservation}) RETURNING *`)
      .bind(...values, filename, filename, driver, id, version, filename, filename, driver);
    const statements = [update];
    if (filename) statements.push(finishUpload(c.env, filename, driver));
    const [result] = await c.env.DB.batch(statements);
    const row = result.results[0];
    if (!row) throw new HTTPException(409, { message: 'Item changed or upload expired; reload and try again' });
    scheduleCleanup(c);
    return c.json(row);
  } catch (err) { await failedUpload(c, filename, driver); throw err; }
});

items.delete('/:id', requireAuth, async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(positiveId(c.req.param('id'))).run();
  if (!result.meta.changes) throw new HTTPException(404, { message: 'Item not found' });
  // D1 trigger recorded the old image atomically, including cascaded deletions.
  scheduleCleanup(c);
  return c.json({ success: true });
});
export default items;
