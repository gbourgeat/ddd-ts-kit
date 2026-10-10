import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { identityPermissions } from '../../authorization/identity.permissions.js';

@Requires(identityPermissions['delegation.revoke'], {
  resource: (command: RevokeDelegationCommand) => ({
    type: 'desk',
    id: `${command.desk.practiceId}.${command.desk.practitionerId}`,
  }),
})
export class RevokeDelegationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly desk: { readonly practiceId: string; readonly practitionerId: string },
    readonly delegationId: string,
  ) {
    super(actor);
  }
}
