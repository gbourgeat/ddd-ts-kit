import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ERASED_PERSONAL_DATA } from '../../application/event-sourcing/erased-personal-data.js';
import { isStoredData } from '../../application/event-sourcing/is-stored-data.js';
import type { StoredData } from '../../application/event-sourcing/stored-data.js';
import type { StoredJson } from '../../application/event-sourcing/stored-json.js';
import type { SubjectKey } from '../../application/event-sourcing/subject-key.js';
import type { SubjectKeyStore } from '../../application/ports/subject-key-store.js';
import { rewriteObjects } from './rewrite-objects.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Crypto-shredding of the personal values of stored data. `seal` replaces each value marked with
 * `personalData(subject, value)` by its encryption under the current key of its subject (AES-256-GCM,
 * a fresh nonce per value, the key id written next to it); `open` gives the values back, and
 * `ERASED_PERSONAL_DATA` for those whose key was destroyed by `SubjectKeyStore.erase`.
 */
export class PersonalDataCipher {
  constructor(private readonly keys: SubjectKeyStore) {}

  /** Whether the data holds a personal value, sealed or not. */
  static holdsPersonalData(data: StoredData): boolean {
    return holdsIn(data);
  }

  seal(data: StoredData): Promise<StoredData> {
    return rewriteObjects(data, (object) => {
      const personal = personalOf(object);

      return personal === undefined ? undefined : this.sealed(personal.subject, personal.value);
    });
  }

  open(data: StoredData): Promise<StoredData> {
    return rewriteObjects(data, (object) => {
      const sealed = sealedOf(object);

      return sealed === undefined ? undefined : this.opened(sealed);
    });
  }

  private async sealed(subject: string, value: string): Promise<StoredJson> {
    const key = await this.keys.keyFor(subject);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, materialOf(key), iv);

    cipher.setAAD(Buffer.from(key.id));

    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);

    return { $sealed: { key: key.id, iv: iv.toString('base64'), data: encrypted.toString('base64') } };
  }

  private async opened(sealed: Sealed): Promise<StoredJson> {
    const key = await this.keys.find(sealed.key);

    if (key === undefined) {
      return ERASED_PERSONAL_DATA;
    }

    const bytes = Buffer.from(sealed.data, 'base64');
    const decipher = createDecipheriv(ALGORITHM, materialOf(key), Buffer.from(sealed.iv, 'base64'));

    decipher.setAAD(Buffer.from(key.id));
    decipher.setAuthTag(bytes.subarray(bytes.length - TAG_BYTES));

    return Buffer.concat([decipher.update(bytes.subarray(0, bytes.length - TAG_BYTES)), decipher.final()]).toString(
      'utf8',
    );
  }
}

interface Sealed {
  readonly key: string;
  readonly iv: string;
  readonly data: string;
}

function materialOf(key: SubjectKey): Buffer {
  return Buffer.from(key.material, 'base64');
}

function holdsIn(value: StoredJson): boolean {
  if (isStoredData(value)) {
    return isMarked(value) || Object.values(value).some(holdsIn);
  }

  return Array.isArray(value) && value.some((item: StoredJson) => holdsIn(item));
}

function isMarked(value: StoredData): boolean {
  return personalOf(value) !== undefined || sealedOf(value) !== undefined;
}

function personalOf(object: StoredData): { readonly subject: string; readonly value: string } | undefined {
  const marked = onlyField(object, '$personal');
  const subject = marked?.['subject'];
  const value = marked?.['value'];

  return typeof subject === 'string' && typeof value === 'string' ? { subject, value } : undefined;
}

function sealedOf(object: StoredData): Sealed | undefined {
  const marked = onlyField(object, '$sealed');
  const key = marked?.['key'];
  const iv = marked?.['iv'];
  const data = marked?.['data'];

  return typeof key === 'string' && typeof iv === 'string' && typeof data === 'string' ? { key, iv, data } : undefined;
}

function onlyField(object: StoredData, field: string): StoredData | undefined {
  const value = object[field];

  return Object.keys(object).length === 1 && isStoredData(value) ? value : undefined;
}
