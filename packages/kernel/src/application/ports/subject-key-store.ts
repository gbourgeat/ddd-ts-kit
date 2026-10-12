import type { SubjectKey } from '../event-sourcing/subject-key.js';

/**
 * The keys personal data is sealed with, one per data subject (crypto-shredding). Erasing a
 * subject destroys its key: every value sealed with it, in every stored event and snapshot and
 * in every backup of them, can no longer be read. Keep it where a deletion is a deletion.
 */
export abstract class SubjectKeyStore {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.SubjectKeyStore' });
  }

  /** The current key of the subject, created when it has none, a first time or after an erasure. */
  abstract keyFor(subject: string): Promise<SubjectKey>;

  /** The key of this id, `undefined` once its subject was erased. */
  abstract find(keyId: string): Promise<SubjectKey | undefined>;

  /** Destroys the keys of the subject. Answers whether there was one. */
  abstract erase(subject: string): Promise<boolean>;
}
