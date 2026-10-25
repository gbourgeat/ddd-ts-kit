import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Policy } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** An account revokes the delegations of an organisation where its role lets it delegate. */
{{#if style.declared}}
@Policy({{context.camel}}Permissions['delegation.revoke'], { name: '{{context.kebab}}.revoke-delegations' })
{{/if}}
export class RevokeDelegationsPolicy {
{{#unless style.declared}}
  readonly name = '{{context.kebab}}.revoke-delegations';

  readonly permission = {{context.camel}}Permissions['delegation.revoke'];

{{/unless}}
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.GrantDelegations);
  }
}
