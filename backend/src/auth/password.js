import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [format, saltValue, hashValue, extra] = String(encoded ?? '').split('$');
  if (format !== 'scrypt' || !saltValue || !hashValue || extra) return false;
  try {
    const expected = Buffer.from(hashValue, 'base64url');
    if (expected.length !== KEY_LENGTH) return false;
    const actual = Buffer.from(
      await scrypt(password, Buffer.from(saltValue, 'base64url'), KEY_LENGTH),
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
