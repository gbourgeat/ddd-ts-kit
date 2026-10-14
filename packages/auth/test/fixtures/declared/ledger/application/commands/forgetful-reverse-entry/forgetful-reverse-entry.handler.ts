import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { EntryRepository } from '../../../domain/repositories/entry.repository.js';
import { ForgetfulReverseEntry } from './forgetful-reverse-entry.command.js';

/** Removes the entry without asking the policy of its permission: what `PolicyNotAskedError` is for. Not in the barrel of the context: `forgetful.declarations.ts` carries it. */
@CommandHandler(ForgetfulReverseEntry)
export class ForgetfulReverseEntryHandler implements CommandHandler<ForgetfulReverseEntry> {
  constructor(private readonly entries: EntryRepository) {}

  async execute(command: ForgetfulReverseEntry): Promise<void> {
    await this.entries.remove(command.entryId);
  }
}
