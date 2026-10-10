import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { identityPermissions } from '../../authorization/identity.permissions.js';

/** Ends every delegation whose end date is reached at `at`, the instant the occurrence of the job was planned for. */
@Requires(identityPermissions['delegation.expire'], { resource: () => ({ type: 'context', id: 'identity' }) })
export class ExpireDelegationsCommand extends AuthorizedCommand<void> {
  constructor(
    actor: Actor,
    readonly at: Date,
  ) {
    super(actor);
  }
}
