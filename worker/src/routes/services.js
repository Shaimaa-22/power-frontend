import { Hono } from 'hono';

const services = new Hono();

// GET /api/services — the 4 fixed services seeded by schema.sql
services.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM services ORDER BY id').all();
  return c.json(results);
});

export default services;
