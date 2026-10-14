import { injected } from '@ddd-ts-kit/kernel/declarations';
import { Access } from '../../../../src/index.js';
import { PostEntryHandler } from './application/commands/post-entry/post-entry.handler.js';
import { ReverseEntryHandler } from './application/commands/reverse-entry/reverse-entry.handler.js';
import { CountEntriesHandler } from './application/queries/count-entries/count-entries.handler.js';
import { EntryRepository } from './domain/repositories/entry.repository.js';

export * from './application/authorization/only-poster-reverses.policy.js';
export * from './application/commands/post-entry/post-entry.command.js';
export * from './application/commands/post-entry/post-entry.handler.js';
export * from './application/commands/reverse-entry/reverse-entry.command.js';
export * from './application/commands/reverse-entry/reverse-entry.handler.js';
export * from './application/queries/count-entries/count-entries.handler.js';
export * from './application/queries/count-entries/count-entries.query.js';
export * from './infrastructure/persistence/in-memory-entry.repository.js';

injected(PostEntryHandler, [EntryRepository]);
injected(ReverseEntryHandler, [EntryRepository, Access]);
injected(CountEntriesHandler, [EntryRepository]);
