import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { EntryRepository } from '../../../domain/repositories/entry.repository.js';
import { CountEntries } from './count-entries.query.js';

@QueryHandler(CountEntries, [EntryRepository])
export class CountEntriesHandler implements QueryHandler<CountEntries> {
  constructor(private readonly entries: EntryRepository) {}

  execute(): Promise<number> {
    return this.entries.count();
  }
}
