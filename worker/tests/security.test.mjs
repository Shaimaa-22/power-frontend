import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { sign } from 'hono/jwt';
import { app } from '../src/index.js';
import { signToken } from '../src/lib/auth.js';
import { hashPassword, verifyPassword, passwordIterations } from '../src/lib/password.js';
import { fixture, json, testPassword } from './helpers.mjs';

test('new PBKDF2 hashes and legacy 1000/20000/100000 hashes remain verifiable', async () => {
  const stored = await hashPassword(testPassword);
  assert.match(stored, /^pbkdf2\$100000\$/);
  assert.equal(await verifyPassword(testPassword, stored), true);
  assert.equal(await verifyPassword('wrong', stored), false);
  for (const rounds of [1000, 20000, 100000]) {
    const salt = Buffer.alloc(16, 7);
    const hash = pbkdf2Sync('oldpass', salt, rounds, 32, 'sha256');
    const old = `pbkdf2$${rounds}$${salt.toString('base64')}$${hash.toString('base64')}`;
    assert.equal(await verifyPassword('oldpass', old), true);
  }
  for (const value of [0, 19999, 100001, 1.5, 'bad', '']) assert.throws(() => passwordIterations(value));
  for (const stored of ['garbage', 'pbkdf2$999999999$xxx$xxx', 'pbkdf2$20000$!$!']) assert.equal(await verifyPassword('pass', stored), false);
});

test('login success, legacy short password, generic failures and validation', async t => {
  const f = fixture(t); await f.seed('admin@example.com', 'oldpass');
  const login = body => app.request('/api/auth/login', json(body), f.env, f.ctx);
  const success = await login({ email: 'admin@example.com', password: 'oldpass' });
  assert.equal(success.status, 200); assert.equal(success.headers.get('cache-control'), 'no-store');
  assert.equal(typeof (await success.json()).token, 'string');
  const wrong = await login({ email: 'admin@example.com', password: 'wrong' });
  const missing = await login({ email: 'missing@example.com', password: 'wrong' });
  assert.equal(wrong.status, 401); assert.deepEqual(await wrong.json(), await missing.json());
  assert.equal((await login({ email: 'not-email', password: 'x' })).status, 400);
  assert.equal((await login({ email: 'a@b.com', password: 'x'.repeat(129) })).status, 400);
  assert.equal((await app.request('/api/auth/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: '{' }, f.env)).status, 400);
});

test('rate limiter denies requests before hashing and missing binding fails closed', async t => {
  const f = fixture(t); await f.seed();
  f.env.AUTH_RATE_LIMITER = { limit: async () => ({ success: false }) };
  const response = await app.request('/api/auth/login', json({ email: 'admin@example.com', password: testPassword }), f.env);
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
  delete f.env.AUTH_RATE_LIMITER;
  assert.equal((await app.request('/api/auth/login', json({}), f.env)).status, 503);
});

test('JWT requires valid signature, expiry, version, live account and active state', async t => {
  const f = fixture(t); const admin = await f.seed();
  const token = await signToken(f.env, admin);
  const get = token => app.request('/api/admins', { headers: token ? { Authorization: 'Bearer ' + token } : {} }, f.env);
  assert.equal((await get(token)).status, 200);
  for (const bad of [null, token + 'x', await sign({ adminId: admin.id, tokenVersion: 0, exp: 1 }, f.env.JWT_SECRET, 'HS256'),
    await sign({ adminId: admin.id, exp: 9999999999 }, f.env.JWT_SECRET, 'HS256')]) assert.equal((await get(bad)).status, 401);
  f.sqlite.prepare('UPDATE admins SET is_active = 0 WHERE id = ?').run(admin.id);
  assert.equal((await get(token)).status, 401);
  f.sqlite.prepare('UPDATE admins SET is_active = 1 WHERE id = ?').run(admin.id);
  assert.equal((await get(token)).status, 401);
  const current = f.sqlite.prepare('SELECT * FROM admins WHERE id = ?').get(admin.id);
  const activeToken = await signToken(f.env, current);
  f.sqlite.prepare('DELETE FROM admins WHERE id = ?').run(admin.id);
  assert.equal((await get(activeToken)).status, 401);
});

test('password change and direct SQL reset revoke all prior tokens without breaking login', async t => {
  const f = fixture(t); const admin = await f.seed(); const token = await signToken(f.env, admin);
  assert.equal((await app.request('/api/auth/password', json({ current_password: 'wrong', new_password: 'a new secure passphrase' }, token), f.env)).status, 403);
  assert.equal((await app.request('/api/auth/password', json({ current_password: testPassword, new_password: 'a new secure passphrase' }, token), f.env)).status, 200);
  assert.equal((await app.request('/api/admins', { headers: { Authorization: 'Bearer '+token } }, f.env)).status, 401);
  const updated = f.sqlite.prepare('SELECT * FROM admins WHERE id = ?').get(admin.id);
  assert.equal(updated.token_version, 1);
  assert.equal(await verifyPassword('a new secure passphrase', updated.password_hash), true);
  const newToken = await signToken(f.env, updated);
  f.sqlite.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(await hashPassword(testPassword, 20000), admin.id);
  assert.equal((await app.request('/api/admins', { headers: { Authorization: 'Bearer '+newToken } }, f.env)).status, 401);
});

test('admin authorization, last active account protection, invalid IDs and bodies', async t => {
  const f = fixture(t); const admin = await f.seed(); const token = await signToken(f.env, admin);
  assert.equal((await app.request('/api/admins', json({ email:'new@example.com', password:testPassword }), f.env)).status, 401);
  assert.equal((await app.request('/api/admins', json({ email:'<x>@example.com', password:testPassword }, token), f.env)).status, 400);
  assert.equal((await app.request('/api/admins', json({ email:'new@example.com', password:'short' }, token), f.env)).status, 400);
  await f.seed('disabled@example.com'); f.sqlite.exec("UPDATE admins SET is_active=0 WHERE email='disabled@example.com'");
  assert.equal((await app.request('/api/admins/'+admin.id, { method:'DELETE', headers:{Authorization:'Bearer '+token} }, f.env)).status, 400);
  assert.equal((await app.request('/api/items/category/not-a-number', {}, f.env)).status, 400);
  assert.equal((await app.request('/api/categories', json([], token), f.env)).status, 400);
  const created = await app.request('/api/admins', json({ email:'new@example.com', password:testPassword }, token), f.env);
  assert.equal(created.status, 201); assert.equal('password_hash' in await created.json(), false);
  assert.equal((await app.request('/api/admins', json({ email:'new@example.com', password:testPassword }, token), f.env)).status, 409);
  const cors = await app.request('/api/items', { method:'OPTIONS', headers:{Origin:'https://frontend.example','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'} }, f.env);
  assert.equal(cors.status, 204); assert.equal(cors.headers.get('access-control-allow-origin'), '*');
});
