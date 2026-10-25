import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Policy } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** An account searches the members of an organisation it belongs to. */
{{#if style.declared}}
@Policy({{context.camel}}Permissions['member.search'], { name: '{{context.kebab}}.read-members' })
{{/if}}
export class ReadMembersPolicy {
{{#unless style.declared}}
  readonly name = '{{context.kebab}}.read-members';

  readonly permission = {{context.camel}}Permissions['member.search'];

{{/unless}}
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.ReadMembers);
  }
}
