import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { isStoredData } from '../../application/event-sourcing/is-stored-data';
import { isStoredList } from '../../application/event-sourcing/is-stored-list';
import type { StoredData } from '../../application/event-sourcing/stored-data';
import type { StoredJson } from '../../application/event-sourcing/stored-json';
import type { SubjectKey } from '../../application/event-sourcing/subject-key';
import type { SubjectKeyStore } from '../../application/ports/subject-key-store';
import { rewriteObjects } from './rewrite-objects';
import type { SubjectValues } from './subject-values';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Crypto-shredding of the personal values of stored data. `seal` replaces each value marked with
 * `personalData(subject, value)` by its encryption under the current key of its subject (AES-256-GCM,
 * a fresh nonce per value, the key id written next to it); `open` gives the values back, and
 * an `ErasedValue` (`{ $erased: { key } }`) for those whose key was destroyed by `SubjectKeyStore.erase`,
 * which `StoredEventData` reads as `ERASED_PERSONAL_DATA`: an erased value is told apart from any text.
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

  /**
   * The values of the data sealed with a key of the subject that still exists, opened, each under
   * its path in the data (`reason`, `cancelled.reason`, `contacts[0]`): what an export hands over
   * of the person. A value of anyone else, or whose key was destroyed, is left out; a value of the
   * subject that does not decipher is named in `unreadable`, and the others are opened all the
   * same. `find` looks a key up, the key store by default: a reader of many events gives one that
   * remembers.
   */
  async valuesOf(
    subject: string,
    data: StoredData,
    find: (keyId: string) => Promise<SubjectKey | undefined> = (keyId) => this.keys.find(keyId),
  ): Promise<SubjectValues> {
    const values: Record<string, string> = {};
    const unreadable: string[] = [];

    for (const { path, sealed } of sealedIn(data, '')) {
      const key = await find(sealed.key);

      if (key?.subject !== subject) {
        continue;
      }

      const opened = decipheredOrNot(key, sealed);

      if (opened === undefined) {
        unreadable.push(path);
      } else {
        values[path] = opened;
      }
    }

    return { values, unreadable };
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

    return key === undefined ? { $erased: { key: sealed.key } } : deciphered(key, sealed);
  }
}

/** The value, or `undefined` when it does not decipher under its key: a sealed value altered, or a key that is not its. */
function decipheredOrNot(key: SubjectKey, sealed: Sealed): string | undefined {
  try {
    return deciphered(key, sealed);
  } catch {
    return undefined;
  }
}

function deciphered(key: SubjectKey, sealed: Sealed): string {
  const bytes = Buffer.from(sealed.data, 'base64');
  const decipher = createDecipheriv(ALGORITHM, materialOf(key), Buffer.from(sealed.iv, 'base64'));

  decipher.setAAD(Buffer.from(key.id));
  decipher.setAuthTag(bytes.subarray(bytes.length - TAG_BYTES));

  return Buffer.concat([decipher.update(bytes.subarray(0, bytes.length - TAG_BYTES)), decipher.final()]).toString(
    'utf8',
  );
}

/** Every sealed value of the data, at any depth, with its path. */
function* sealedIn(value: StoredJson, path: string): Generator<{ readonly path: string; readonly sealed: Sealed }> {
  if (isStoredList(value)) {
    for (const [index, item] of value.entries()) {
      yield* sealedIn(item, `${path}[${index}]`);
    }

    return;
  }

  if (!isStoredData(value)) {
    return;
  }

  const sealed = sealedOf(value);

  if (sealed !== undefined) {
    yield { path, sealed };

    return;
  }

  for (const [field, item] of Object.entries(value)) {
    yield* sealedIn(item, path === '' ? field : `${path}.${field}`);
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
