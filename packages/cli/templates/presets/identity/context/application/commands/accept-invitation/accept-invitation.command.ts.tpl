import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** Accepts the invitation of this token, addressed to the actor: the actor becomes a member. */
@Requires({{context.camel}}Permissions['invitation.accept'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class AcceptInvitationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly token: string,
  ) {
    super(actor);
  }
}
