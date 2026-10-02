// Keep the existing PBKDF2-SHA256 format. 100k is workerd's PBKDF2 ceiling,
// not OWASP's 600k target. Use passphrases + throttling and profile Workers CPU.
export const MAX_ITERATIONS = 100000;
export const DEFAULT_ITERATIONS = 100000;
const encoder = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (str) => Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0));

export function passwordIterations(value = DEFAULT_ITERATIONS) {
  const rounds = Number(value);
  if (!Number.isInteger(rounds) || rounds < 20000 || rounds > MAX_ITERATIONS) {
    throw new Error('PBKDF2_ITERATIONS must be an integer between 20000 and 100000');
  }
  return rounds;
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const rounds = passwordIterations(iterations);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, rounds);
  return `pbkdf2$${rounds}$${toB64(salt)}$${toB64(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || stored.length > 256) return false;
  try {
    const parts = stored.split('$');
    const [scheme, iterations, saltB64, hashB64] = parts;
    const rounds = Number(iterations);
    // Preserve even the old implementation's minimum work factor.
    if (parts.length !== 4 || scheme !== 'pbkdf2' || !Number.isInteger(rounds) || rounds < 1000 || rounds > MAX_ITERATIONS) return false;
    const salt = fromB64(saltB64), expected = fromB64(hashB64);
    if (salt.length !== 16 || expected.length !== 32) return false;
    const actual = new Uint8Array(await derive(password, salt, rounds));
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}

// Non-secret dummy hash: missing accounts still do a password derivation.
export function dummyHash(iterations) {
  return `pbkdf2$${passwordIterations(iterations)}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;
}
