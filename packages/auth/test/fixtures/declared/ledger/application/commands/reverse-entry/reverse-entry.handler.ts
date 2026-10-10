import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Access } from '../../../../../../../src/index.js';
import { EntryRepository } from '../../../domain/repositories/entry.repository.js';
import { ledgerPermissions } from '../../authorization/ledger.permissions.js';
import { ReverseEntry } from './reverse-entry.command.js';

@CommandHandler(ReverseEntry, [EntryRepository, Access])
export class ReverseEntryHandler implements CommandHandler<ReverseEntry> {
  constructor(
    private readonly entries: EntryRepository,
    private readonly access: Access,
  ) {}

  async execute(command: ReverseEntry): Promise<void> {
    const entry = await this.entries.findById(command.entryId);

    await this.access.authorize(command.actor, ledgerPermissions['entry.reverse'], entry);
    await this.entries.remove(command.entryId);
  }
}
