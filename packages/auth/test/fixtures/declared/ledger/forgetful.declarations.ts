import { injected } from '@ddd-ts-kit/kernel/declarations';
import { ForgetfulReverseEntryHandler } from './application/commands/forgetful-reverse-entry/forgetful-reverse-entry.handler.js';
import { EntryRepository } from './domain/repositories/entry.repository.js';

export * from './application/commands/forgetful-reverse-entry/forgetful-reverse-entry.command.js';
export * from './application/commands/forgetful-reverse-entry/forgetful-reverse-entry.handler.js';

injected(ForgetfulReverseEntryHandler, [EntryRepository]);
