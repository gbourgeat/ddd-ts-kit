import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** Declines the invitation of this token, addressed to the actor. */
@Requires({{context.camel}}Permissions['invitation.decline'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class DeclineInvitationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly token: string,
  ) {
    super(actor);
  }
}
