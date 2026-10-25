import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Policy } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** An account removes members of an organisation where it manages the members. */
{{#if style.declared}}
@Policy({{context.camel}}Permissions['member.remove'], { name: '{{context.kebab}}.remove-members' })
{{/if}}
export class RemoveMembersPolicy {
{{#unless style.declared}}
  readonly name = '{{context.kebab}}.remove-members';

  readonly permission = {{context.camel}}Permissions['member.remove'];

{{/unless}}
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.ManageMembers);
  }
}
