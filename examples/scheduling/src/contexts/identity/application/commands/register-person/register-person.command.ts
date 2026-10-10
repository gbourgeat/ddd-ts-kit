import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { identityPermissions } from '#src/contexts/identity/application/authorization/identity.permissions.js';

/** A person registers themselves: the person is the actor, known by the identity the identity provider issued. */
@Requires(identityPermissions['person.register'], { resource: () => ({ type: 'context', id: 'identity' }) })
export class RegisterPersonCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly displayName: string,
    readonly email: string,
  ) {
    super(actor);
  }
}
