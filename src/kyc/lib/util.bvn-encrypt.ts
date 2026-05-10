import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

export function encryptBvn(bvn: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(bvn, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptBvn(stored: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const [ivB64, tagB64, encB64] = stored.split(':');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64!, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64!, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
