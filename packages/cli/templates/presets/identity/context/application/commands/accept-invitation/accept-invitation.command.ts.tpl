import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Accepts the invitation of this token, addressed to the actor: the actor becomes a member. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['invitation.accept'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class AcceptInvitationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly token: string,
  ) {
    super(actor);
  }
}
