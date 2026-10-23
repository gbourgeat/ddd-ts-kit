import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { identityPermissions } from '@/contexts/identity/identity.permissions';

@Requires(identityPermissions['delegation.grant'], {
  resource: (command: GrantDelegationCommand) => ({
    type: 'desk',
    id: `${command.desk.practiceId}.${command.desk.practitionerId}`,
  }),
})
export class GrantDelegationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly desk: { readonly practiceId: string; readonly practitionerId: string },
    readonly terms: { readonly assistantId: string; readonly availabilityIncluded: boolean; readonly endsAt?: Date },
  ) {
    super(actor);
  }
}
