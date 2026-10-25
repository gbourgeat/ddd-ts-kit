import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Policy } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** An account takes back the invitations of an organisation where it may invite. */
{{#if style.declared}}
@Policy({{context.camel}}Permissions['invitation.revoke'], { name: '{{context.kebab}}.revoke-invitations' })
{{/if}}
export class RevokeInvitationsPolicy {
{{#unless style.declared}}
  readonly name = '{{context.kebab}}.revoke-invitations';

  readonly permission = {{context.camel}}Permissions['invitation.revoke'];

{{/unless}}
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.InviteMembers);
  }
}
