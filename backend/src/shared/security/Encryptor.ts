import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Шифрування чутливих полів на рівні застосунку (NFR-03): нотатки клієнта, скани документів. */
export interface Encryptor {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

/**
 * AES-256-GCM. Формат результату: base64(iv[12] | authTag[16] | ciphertext).
 * Ключ (32 байти) у production надходить зі сховища секретів (KMS), а не з коду.
 */
export class AesGcmEncryptor implements Encryptor {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    this.key = Buffer.from(hexKey, 'hex');
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY має бути 32 байти у hex-форматі (64 символи)');
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(payload: string): string {
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
