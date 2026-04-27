
import * as crypto from 'crypto';
import { cookies } from 'next/headers';

const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
export const COOKIE_NAME = 'user-phone';

if (!ENCRYPTION_SECRET_KEY) {
  throw new Error('ENCRYPTION_SECRET_KEY must be set in .env');
}

// Derive a consistent key from the secret using a more secure salt
const KEY = crypto.scryptSync(ENCRYPTION_SECRET_KEY, 'vpc-auth-salt-v1', 32);

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Return iv:encrypted to store the unique IV with the ciphertext
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) {
    return '';
  }

  try {
    const [ivHex, ciphertext] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return '';
  }
}

export async function setEncryptedPhoneCookie(phoneNumber: string) {
  const encryptedPhone = encrypt(phoneNumber);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encryptedPhone, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  });
}

export async function setAccountsCookie(accounts: any[]) {
  const cookieStore = await cookies();
  cookieStore.set('user-accounts', JSON.stringify(accounts), {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  });
}

export async function getAccountsFromCookie(): Promise<any[] | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('user-accounts');
  if (!cookie?.value) return null;
  try {
    return JSON.parse(cookie.value);
  } catch {
    return null;
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', { maxAge: 0 });
  cookieStore.set('user-accounts', '', { maxAge: 0 });
}

export async function getDecryptedPhoneFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) {
    return null;
  }

  try {
    const decryptedPhone = decrypt(cookie.value);
    if (!decryptedPhone) {
        // This means decryption failed. Clear the invalid cookies.
        await clearAuthCookies();
        return null;
    }
    return decryptedPhone;
  } catch (error) {
    // Clear the corrupted cookies
    await clearAuthCookies();
    return null;
  }
}

const ALGORITHM = 'aes-256-cbc';
