import type { SubjectKey } from '../event-sourcing/subject-key';

/**
 * The keys personal data is sealed with, one per data subject (crypto-shredding). Erasing a
 * subject destroys its key: every value sealed with it can no longer be read from the live
 * events and snapshots, nor from a backup of them that does not hold the key. A backup that
 * holds the events and the keys together still opens them until it expires, so keep the keys
 * apart from the events in production, with a shorter backup retention.
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
