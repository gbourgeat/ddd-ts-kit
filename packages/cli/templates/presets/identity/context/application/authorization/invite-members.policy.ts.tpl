import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Policy } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** An account invites to an organisation when its role, or a delegation, lets it invite there. */
{{#if style.declared}}
@Policy({{context.camel}}Permissions['member.invite'], { name: '{{context.kebab}}.invite-members' })
{{/if}}
export class InviteMembersPolicy {
{{#unless style.declared}}
  readonly name = '{{context.kebab}}.invite-members';

  readonly permission = {{context.camel}}Permissions['member.invite'];

{{/unless}}
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.InviteMembers);
  }
}
