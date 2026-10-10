import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { identityPermissions } from '../../authorization/identity.permissions.js';

@Requires(identityPermissions['member.remove'], {
  resource: (command: RemoveMemberCommand) => ({ type: 'practice', id: command.practiceId }),
})
export class RemoveMemberCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly personId: string,
  ) {
    super(actor);
  }
}
