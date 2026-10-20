import { injected } from '@ddd-ts-kit/kernel/declarations';
import { Access } from '../../../../../../src/index.js';
import { EntryRepository } from '../../domain/repositories/entry.repository.js';
import { PostEntryHandler } from './post-entry/post-entry.handler.js';
import { ReverseEntryHandler } from './reverse-entry/reverse-entry.handler.js';

export * from './post-entry/post-entry.command.js';
export * from './post-entry/post-entry.handler.js';
export * from './reverse-entry/reverse-entry.command.js';
export * from './reverse-entry/reverse-entry.handler.js';

injected(PostEntryHandler, [EntryRepository]);
injected(ReverseEntryHandler, [EntryRepository, Access]);
