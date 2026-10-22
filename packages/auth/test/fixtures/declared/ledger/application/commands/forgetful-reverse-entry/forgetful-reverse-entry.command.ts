import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { ledgerPermissions } from '../../authorization/ledger.permissions';

@Requires(ledgerPermissions['entry.reverse'])
export class ForgetfulReverseEntry extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly entryId: string,
  ) {
    super(actor);
  }
}
