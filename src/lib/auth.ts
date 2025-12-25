
'use server';

import { cookies } from 'next/headers';
import * as crypto from 'crypto';

const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
const ENCRYPTION_IV = process.env.ENCRYPTION_IV;
const COOKIE_NAME = 'user-phone';

if (!ENCRYPTION_SECRET_KEY || !ENCRYPTION_IV) {
  throw new Error('ENCRYPTION_SECRET_KEY and ENCRYPTION_IV must be set in .env');
}

const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.scryptSync(ENCRYPTION_SECRET_KEY, 'salt', 32);
const IV = crypto.scryptSync(ENCRYPTION_IV, 'salt', 16);

function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function setEncryptedPhoneCookie(phoneNumber: string) {
  const c = await cookies();
  const encryptedPhone = encrypt(phoneNumber);
  c.set(COOKIE_NAME, encryptedPhone, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
  });
}

export async function getDecryptedPhoneFromCookie(): Promise<string | null> {
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME);
  if (!cookie?.value) {
    return null;
  }

  try {
    const decryptedPhone = decrypt(cookie.value);
    return decryptedPhone;
  } catch (error) {
    console.error('Failed to decrypt cookie:', error);
    // Clear the corrupted cookie
    c.set(COOKIE_NAME, '', { maxAge: 0 });
    return null;
  }
}
