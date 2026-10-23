import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** Invites a person to an organisation by email address, in a role: the answer carries the token to send them, never stored. */
@Requires({{context.camel}}Permissions['member.invite'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class InviteMemberCommand extends AuthorizedCommand<{ readonly id: string; readonly token: string }> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly invitee: { readonly email: string; readonly role: MemberRole },
  ) {
    super(actor);
  }
}
