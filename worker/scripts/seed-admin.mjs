// Local Node administration utility; never imported by the Worker.
// Usage: npm run seed-admin -- email@example.com --local|--remote|--sql-only
import { writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { hashPassword, passwordIterations } from '../src/lib/password.js';
import { emailAddress, passwordPolicy } from '../src/lib/validation.js';

async function hiddenInput(prompt) {
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal. Password arguments and piped passwords are not accepted.');
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write('\n');
      error ? reject(error) : resolve(value);
    };
    const onKey = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') return finish(new Error('Cancelled'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') value = Array.from(value).slice(0, -1).join('');
      else if (!key.ctrl && !key.meta && str && !/[\x00-\x1f\x7f]/.test(str)) {
        value += str;
        if (value.length > 1024) finish(new Error('Password input is too long'));
      }
    };
    process.stdin.on('keypress', onKey);
  });
}

try {
  const args = process.argv.slice(2);
  const modes = args.filter(a => ['--local', '--remote', '--sql-only'].includes(a));
  if (args.length !== 2 || modes.length !== 1) throw new Error('Usage: npm run seed-admin -- email@example.com --local|--remote|--sql-only (password is prompted)');
  const email = emailAddress(args.find(a => !a.startsWith('--')));
  const iterations = passwordIterations(process.env.PBKDF2_ITERATIONS);
  const password = passwordPolicy(await hiddenInput('Password (15–128 characters, hidden): '));
  if (password !== await hiddenInput('Confirm password (hidden): ')) throw new Error('Passwords do not match');
  const stored = await hashPassword(password, iterations);
  const quote = value => "'" + value.replace(/'/g, "''") + "'";
  // The migration's trigger increments token_version on reset, even through this script.
  const sql = `INSERT INTO admins(email, password_hash) VALUES (${quote(email)}, ${quote(stored)})\n` +
    `ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash;\n`;
  const file = fileURLToPath(new URL('../.seed-admin-' + crypto.randomUUID() + '.sql', import.meta.url));
  writeFileSync(file, sql, { mode: 0o600, flag: 'wx' });
  if (modes[0] === '--sql-only') {
    console.log('No database was changed. Apply this ignored SQL file in the D1 Dashboard console, then delete it: ' + file);
  } else {
    try {
      const bin = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
      const result = spawnSync(process.execPath, [bin, 'd1', 'execute', 'power-db', modes[0], '--file=' + file],
        { stdio: 'inherit', cwd: fileURLToPath(new URL('..', import.meta.url)) });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error('D1 command failed. Check schema, migration and selected environment.');
      console.log('Admin created/reset. Existing sessions are revoked after the security migration.');
    } finally { unlinkSync(file); }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
