import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { ledgerPermissions } from '../../authorization/ledger.permissions.js';

@Requires(ledgerPermissions['entry.post'], { resource: (command: PostEntry) => ({ type: 'account', id: command.account }) })
export class PostEntry extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly account: string,
  ) {
    super(actor);
  }
}
