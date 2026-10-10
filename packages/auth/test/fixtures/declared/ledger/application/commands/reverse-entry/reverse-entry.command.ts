import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { ledgerPermissions } from '../../authorization/ledger.permissions.js';

@Requires(ledgerPermissions['entry.reverse'])
export class ReverseEntry extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly entryId: string,
  ) {
    super(actor);
  }
}
