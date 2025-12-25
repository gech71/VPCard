
import * as crypto from 'crypto';
import { cookies } from 'next/headers';

const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
const ENCRYPTION_IV = process.env.ENCRYPTION_IV;
export const COOKIE_NAME = 'user-phone';

if (!ENCRYPTION_SECRET_KEY || !ENCRYPTION_IV) {
  throw new Error('ENCRYPTION_SECRET_KEY and ENCRYPTION_IV must be set in .env');
}

const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.scryptSync(ENCRYPTION_SECRET_KEY, 'salt', 32);
const IV = crypto.scryptSync(ENCRYPTION_IV, 'salt', 16);

export function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decrypt(encryptedText: string): string {
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
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
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
  });
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
        // This means decryption failed. Clear the invalid cookie.
        cookieStore.set(COOKIE_NAME, '', { maxAge: 0 });
        return null;
    }
    return decryptedPhone;
  } catch (error) {
    console.error('Failed to decrypt cookie:', error);
    // Clear the corrupted cookie
    cookieStore.set(COOKIE_NAME, '', { maxAge: 0 });
    return null;
  }
}
