import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { identityPermissions } from '../../authorization/identity.permissions.js';

@Requires(identityPermissions['member.add'], { resource: (command: AddMemberCommand) => ({ type: 'practice', id: command.practiceId }) })
export class AddMemberCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly member: { readonly personId: string; readonly role: string },
  ) {
    super(actor);
  }
}
