import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** Takes back an invitation of an organisation that was not answered. */
@Requires({{context.camel}}Permissions['invitation.revoke'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class RevokeInvitationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly invitationId: string,
  ) {
    super(actor);
  }
}
