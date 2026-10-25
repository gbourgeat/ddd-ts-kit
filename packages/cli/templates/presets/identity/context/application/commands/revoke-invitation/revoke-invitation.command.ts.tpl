import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Takes back an invitation of an organisation that was not answered. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['invitation.revoke'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class RevokeInvitationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly invitationId: string,
  ) {
    super(actor);
  }
}
