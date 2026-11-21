import * as Crypto from 'expo-crypto';

// Employee passwords are never stored as typed: we keep a random salt and the SHA-256 hash
// of salt + password. Note this only hides the password from someone reading device storage;
// real login security needs a backend that stores a slow hash (bcrypt/argon2) server-side.

export const MIN_PASSWORD_LENGTH = 6;

export function checkPasswordRules(password) {
  if (!password) return 'Please enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(password)) return 'Password cannot start or end with a space.';
  return null;
}

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// Returns { salt, hash } to store with the employee.
export async function hashPassword(password) {
  const salt = toHex(Crypto.getRandomBytes(16));
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
  return { salt, hash };
}

// For a future employee login: true when `password` matches the stored { salt, hash }.
export async function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${stored.salt}:${password}`);
  return hash === stored.hash;
}
