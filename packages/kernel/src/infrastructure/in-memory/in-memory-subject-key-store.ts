import { randomBytes, randomUUID } from 'node:crypto';
import type { SubjectKey } from '../../application/event-sourcing/subject-key';
import type { SubjectKeyStore } from '../../application/ports/subject-key-store';

/** Reference implementation, for tests and single-process apps: the keys die with the process. */
export class InMemorySubjectKeyStore implements SubjectKeyStore {
  private readonly current = new Map<string, SubjectKey>();

  async keyFor(subject: string): Promise<SubjectKey> {
    const held = this.current.get(subject);

    if (held !== undefined) {
      return held;
    }

    const key = { id: randomUUID(), subject, material: randomBytes(32).toString('base64') };

    this.current.set(subject, key);

    return key;
  }

  async find(keyId: string): Promise<SubjectKey | undefined> {
    return [...this.current.values()].find((key) => key.id === keyId);
  }

  async erase(subject: string): Promise<boolean> {
    return this.current.delete(subject);
  }
}
