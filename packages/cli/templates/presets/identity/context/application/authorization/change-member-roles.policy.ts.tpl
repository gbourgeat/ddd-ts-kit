import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Policy } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** An account changes the roles of an organisation where it manages the members. */
{{#if style.declared}}
@Policy({{context.camel}}Permissions['member.change-role'], { name: '{{context.kebab}}.change-member-roles' })
{{/if}}
export class ChangeMemberRolesPolicy {
{{#unless style.declared}}
  readonly name = '{{context.kebab}}.change-member-roles';

  readonly permission = {{context.camel}}Permissions['member.change-role'];

{{/unless}}
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.ManageMembers);
  }
}
