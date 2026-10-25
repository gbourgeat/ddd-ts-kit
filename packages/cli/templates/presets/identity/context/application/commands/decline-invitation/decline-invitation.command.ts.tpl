import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Declines the invitation of this token, addressed to the actor. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['invitation.decline'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class DeclineInvitationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly token: string,
  ) {
    super(actor);
  }
}
