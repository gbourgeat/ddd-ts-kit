import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import type { EntryRepository } from '../../../domain/repositories/entry.repository';
import { CountEntries } from './count-entries.query';

@QueryHandler(CountEntries)
export class CountEntriesHandler implements QueryHandler<CountEntries> {
  constructor(private readonly entries: EntryRepository) {}

  execute(): Promise<number> {
    return this.entries.count();
  }
}
