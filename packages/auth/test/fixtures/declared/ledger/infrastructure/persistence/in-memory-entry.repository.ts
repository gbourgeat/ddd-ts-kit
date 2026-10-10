import { Repository } from '@ddd-ts-kit/kernel/declarations';
import type { Entry } from '../../domain/entry.js';
import { EntryRepository } from '../../domain/repositories/entry.repository.js';

@Repository(EntryRepository)
export class InMemoryEntryRepository implements EntryRepository {
  private readonly posted = new Map<string, Entry>();

  async nextId(): Promise<string> {
    return `entry-${this.posted.size + 1}`;
  }

  async findById(id: string): Promise<Entry | undefined> {
    return this.posted.get(id);
  }

  async save(entry: Entry): Promise<void> {
    this.posted.set(entry.id, entry);
  }

  async remove(id: string): Promise<void> {
    this.posted.delete(id);
  }

  async count(): Promise<number> {
    return this.posted.size;
  }
}
