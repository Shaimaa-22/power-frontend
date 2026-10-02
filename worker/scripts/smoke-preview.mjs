// Explicitly limited to the disposable preview; never uses production config or credentials.
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/lib/password.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const bin = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const origin = 'https://power-preview-20260924.power-elec.workers.dev';
const config = 'wrangler.preview.jsonc';
const database = 'power-preview-20260924-db';
const email = 'smoke-' + crypto.randomUUID() + '@example.invalid';
const password = crypto.randomUUID() + crypto.randomUUID();
const nextPassword = crypto.randomUUID() + crypto.randomUUID();
function wrangler(args, input) {
  const r = spawnSync(process.execPath, [bin, ...args, '--config', config], {
    cwd: root, input, encoding: 'utf8', timeout: 120000,
  });
  if (r.error || r.status !== 0) throw new Error('Preview Wrangler operation failed: ' + (r.error?.message || r.stderr || 'nonzero exit'));
}
function sql(statement) {
  const path = fileURLToPath(new URL('../.seed-admin-' + crypto.randomUUID() + '.sql', import.meta.url));
  writeFileSync(path, statement, { mode: 0o600, flag: 'wx' });
  try { wrangler(['d1', 'execute', database, '--remote', '--file', path]); }
  finally { unlinkSync(path); }
}
async function request(path, { token, body, method = 'GET', status = 200 } = {}) {
  const response = await fetch(origin + path, {
    method, signal: AbortSignal.timeout(20000),
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, status, method + ' ' + path);
  console.log(method + ' ' + path + ': ' + response.status);
  return response;
}

// Rotate ONLY the independent preview secret. It is passed through stdin, never printed/saved.
wrangler(['secret', 'put', 'JWT_SECRET'], crypto.randomUUID() + crypto.randomUUID() + '\n');
const hash = await hashPassword(password, 100000);
sql(`INSERT INTO admins(email,password_hash) VALUES ('${email}','${hash}');`);
try {
  const assets = await request('/admin');
  assert.equal(assets.headers.get('x-content-type-options'), 'nosniff');
  const services = await (await request('/api/services')).json();
  assert.equal(services.length, 4);
  await request('/api/admins', { status: 401 });
  const login = await (await request('/api/auth/login', { method: 'POST', body: { email, password } })).json();
  assert.equal(typeof login.token, 'string');
  await request('/api/admins', { token: login.token });
  await request('/api/auth/password', { method: 'POST', token: login.token, body: { current_password: password, new_password: nextPassword } });
  await request('/api/admins', { token: login.token, status: 401 });
  const reset = await (await request('/api/auth/login', { method: 'POST', body: { email, password: nextPassword } })).json();
  await request('/api/admins', { token: reset.token });
  sql(`DELETE FROM admins WHERE email='${email}';`);
  await request('/api/admins', { token: reset.token, status: 401 });
  console.log('Preview smoke passed; temporary admin removed. Passwords and JWTs were not printed.');
} finally {
  sql(`DELETE FROM admins WHERE email='${email}';`);
}
