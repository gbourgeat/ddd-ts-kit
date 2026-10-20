import { injected } from '@ddd-ts-kit/kernel/declarations';
import { EntryRepository } from '../../domain/repositories/entry.repository.js';
import { CountEntriesHandler } from './count-entries/count-entries.handler.js';

export * from './count-entries/count-entries.handler.js';
export * from './count-entries/count-entries.query.js';

injected(CountEntriesHandler, [EntryRepository]);
