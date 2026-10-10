import type { Entry } from '../entry.js';

export abstract class EntryRepository {
  abstract nextId(): Promise<string>;

  abstract findById(id: string): Promise<Entry | undefined>;

  abstract save(entry: Entry): Promise<void>;

  abstract remove(id: string): Promise<void>;

  abstract count(): Promise<number>;
}
