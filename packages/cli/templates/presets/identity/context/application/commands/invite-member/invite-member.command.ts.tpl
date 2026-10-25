import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** Invites a person to an organisation by email address, in a role: the answer carries the token to send them, never stored. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['member.invite'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class InviteMemberCommand extends AuthorizedCommand<{ readonly id: string; readonly token: string }> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly invitee: { readonly email: string; readonly role: MemberRole },
  ) {
    super(actor);
  }
}
