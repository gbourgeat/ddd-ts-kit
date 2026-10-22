import { injected } from '@ddd-ts-kit/kernel/declarations';
import { Access } from '../../../../../../src';
import { EntryRepository } from '../../domain/repositories/entry.repository';
import { PostEntryHandler } from './post-entry/post-entry.handler';
import { ReverseEntryHandler } from './reverse-entry/reverse-entry.handler';

export * from './post-entry/post-entry.command';
export * from './post-entry/post-entry.handler';
export * from './reverse-entry/reverse-entry.command';
export * from './reverse-entry/reverse-entry.handler';

injected(PostEntryHandler, [EntryRepository]);
injected(ReverseEntryHandler, [EntryRepository, Access]);
