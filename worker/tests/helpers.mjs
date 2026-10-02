import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { hashPassword } from '../src/lib/password.js';

export const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
export const migration = readFileSync(new URL('../migrations/0001_security_and_cleanup.sql', import.meta.url), 'utf8');
export const png = readFileSync(new URL('./fixtures/valid.png', import.meta.url));
export const testPassword = 'local test passphrase only';

// Executes real SQLite statements/transactions; no mocked SQL string matching.
export function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(schema); sqlite.exec(migration);
  t.after(() => sqlite.close());
  function prepare(sql, args = []) {
    const all = () => {
      const results = sqlite.prepare(sql).all(...args).map(row => ({ ...row }));
      return { results, success: true, meta: { changes: sqlite.prepare('SELECT changes() AS n').get().n } };
    };
    return { bind: (...values) => prepare(sql, values), first: async () => ({ ...sqlite.prepare(sql).get(...args) }),
      all: async () => all(), run: async () => all(), _all: all };
  }
  // D1 first() returns null, not {} when absent.
  function statement(sql, args = []) {
    return { ...prepare(sql, args), bind: (...values) => statement(sql, values), first: async () => {
      const row = sqlite.prepare(sql).get(...args); return row ? { ...row } : null;
    }};
  }
  const DB = { prepare: statement, batch: async statements => {
    sqlite.exec('BEGIN');
    try { const results = statements.map(s => s._all()); sqlite.exec('COMMIT'); return results; }
    catch (err) { sqlite.exec('ROLLBACK'); throw err; }
  }};
  const counters = new Map();
  const env = { DB, JWT_SECRET: crypto.randomUUID() + crypto.randomUUID(), PBKDF2_ITERATIONS: '20000',
    STORAGE_DRIVER: 'b2', B2_ENDPOINT: 's3.example.invalid', B2_REGION: 'test', B2_BUCKET_NAME: 'test',
    B2_KEY_ID: 'test-only', B2_APPLICATION_KEY: 'test-only',
    AUTH_RATE_LIMITER: { limit: async ({ key }) => {
      const count = (counters.get(key) || 0) + 1; counters.set(key, count); return { success: count <= 10 };
    }},
  };
  const pending = [];
  const ctx = { waitUntil(promise) { pending.push(promise); }, passThroughOnException() {} };
  async function flush() { await Promise.all(pending.splice(0)); }
  async function seed(email = 'admin@example.com', password = testPassword) {
    const hash = await hashPassword(password, 20000);
    return sqlite.prepare('INSERT INTO admins(email,password_hash) VALUES (?,?) RETURNING *').get(email, hash);
  }
  return { sqlite, env, ctx, seed, flush, counters };
}

export function json(body, token) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) };
}
