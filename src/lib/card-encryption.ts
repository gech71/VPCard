import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Derives an encryption key from the encryption secret using scrypt KDF
 */
function deriveKey(secret: string): Buffer {
  const encryptionSecret = process.env.ENCRYPTION_SECRET_KEY;
  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET_KEY environment variable is not set');
  }
  
  const salt = Buffer.from(encryptionSecret, 'hex').slice(0, SALT_LENGTH);
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Encrypts sensitive card data (PAN, expiry date)
 * Uses AES-256-GCM for authenticated encryption
 * 
 * @param plaintext - The sensitive data to encrypt
 * @param keySecret - Secret used to derive encryption key
 * @returns Base64 encoded IV + ciphertext + auth tag
 */
export function encryptCardData(plaintext: string, keySecret: string): string {
  if (!plaintext) return plaintext;
  
  const key = deriveKey(keySecret);
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts sensitive card data (PAN, expiry date)
 * 
 * @param encryptedData - The encrypted string (iv:authTag:ciphertext)
 * @param keySecret - Secret used to derive encryption key
 * @returns Decrypted plaintext
 */
export function decryptCardData(encryptedData: string, keySecret: string): string {
  if (!encryptedData) return encryptedData;
  
  // Check if already plaintext (legacy data or not encrypted)
  if (!encryptedData.includes(':')) {
    return encryptedData;
  }
  
  const key = deriveKey(keySecret);
  const [ivB64, authTagB64, ciphertext] = encryptedData.split(':');
  
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Masks PAN for display (shows only last 4 digits)
 * Format: ************1234
 */
export function maskPan(pan: string): string {
  if (!pan) return '';
  
  // If encrypted, try to decrypt first
  let decrypted = pan;
  try {
    const keySecret = process.env.ENCRYPTION_SECRET_KEY || '';
    if (keySecret && pan.includes(':')) {
      decrypted = decryptCardData(pan, keySecret);
    }
  } catch {
    // If decryption fails, assume it's already masked or plaintext
    return pan;
  }
  
  // Mask all but last 4 digits
  if (decrypted.length >= 4) {
    const lastFour = decrypted.slice(-4);
    return `************${lastFour}`;
  }
  
  return pan;
}

/**
 * Validates that encryption environment is properly configured
 */
export function validateEncryptionConfig(): boolean {
  return !!process.env.ENCRYPTION_SECRET_KEY && process.env.ENCRYPTION_SECRET_KEY.length >= 64;
}