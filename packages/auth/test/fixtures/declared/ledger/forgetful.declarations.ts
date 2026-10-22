import { injected } from '@ddd-ts-kit/kernel/declarations';
import { ForgetfulReverseEntryHandler } from './application/commands/forgetful-reverse-entry/forgetful-reverse-entry.handler';
import { EntryRepository } from './domain/repositories/entry.repository';

export * from './application/commands/forgetful-reverse-entry/forgetful-reverse-entry.command';
export * from './application/commands/forgetful-reverse-entry/forgetful-reverse-entry.handler';

injected(ForgetfulReverseEntryHandler, [EntryRepository]);
