import { injected } from '@ddd-ts-kit/kernel/declarations';
import { EntryRepository } from '../../domain/repositories/entry.repository';
import { CountEntriesHandler } from './count-entries/count-entries.handler';

export * from './count-entries/count-entries.handler';
export * from './count-entries/count-entries.query';

injected(CountEntriesHandler, [EntryRepository]);
