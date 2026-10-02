import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { runCleanup } from './lib/cleanup.js';

import auth from './routes/auth.js';
import admins from './routes/admins.js';
import services from './routes/services.js';
import categories from './routes/categories.js';
import items from './routes/items.js';
import images from './routes/images.js';

const app = new Hono();

// Same as the old backend's open cors(): auth uses Bearer tokens (no cookies), so this is safe.
app.use('*', cors());

// Fail loudly (and clearly) if the signing secret was never set
app.use('/api/*', async (c, next) => {
  if (typeof c.env.JWT_SECRET !== 'string' || c.env.JWT_SECRET.length < 32 || !c.env.DB) {
    console.error('API requires a D1 binding and JWT_SECRET of at least 32 characters');
    return c.json({ error: 'Server is not configured' }, 500);
  }
  await next();
});

app.get('/', (c) => c.text('Power website API is running'));

app.route('/api/auth', auth);
app.route('/api/admins', admins);
app.route('/api/services', services);
app.route('/api/categories', categories);
app.route('/api/items', items);
app.route('/images', images);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Server error' }, 500);
});

export { app };
export default {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runCleanup(env));
  },
};
