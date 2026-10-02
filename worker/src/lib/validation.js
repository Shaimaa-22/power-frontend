import { HTTPException } from 'hono/http-exception';

export function positiveId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new HTTPException(400, { message: 'Invalid ID' });
  }
  return Number(value);
}

export function emailAddress(value) {
  if (typeof value !== 'string') throw new HTTPException(400, { message: 'Invalid email' });
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) {
    throw new HTTPException(400, { message: 'Invalid email' });
  }
  // Preserve existing case-sensitive accounts. Throttle keys are case-folded separately.
  return email;
}

export function passwordPolicy(value, { existing = false } = {}) {
  const min = existing ? 1 : 15;
  if (typeof value !== 'string' || value.length < min || value.length > 128) {
    throw new HTTPException(400, { message: existing ? 'Invalid credentials' : 'Password must contain 15–128 characters' });
  }
  return value;
}

export function textField(value, { required = false, max = 200, empty = false } = {}) {
  if (value === undefined && !required) return null;
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) {
    throw new HTTPException(400, { message: `Invalid text field (maximum ${max} characters)` });
  }
  return value.trim();
}
