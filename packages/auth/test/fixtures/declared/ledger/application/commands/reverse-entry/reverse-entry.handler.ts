import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Access } from '../../../../../../../src';
import type { EntryRepository } from '../../../domain/repositories/entry.repository';
import { ledgerPermissions } from '../../authorization/ledger.permissions';
import { ReverseEntry } from './reverse-entry.command';

@CommandHandler(ReverseEntry)
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
