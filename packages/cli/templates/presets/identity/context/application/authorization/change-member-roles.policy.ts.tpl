import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
import { Policy } from '@ddd-ts-kit/kernel/declarations';
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** An account changes the roles of an organisation where it manages the members. */
@Policy({{context.camel}}Permissions['member.change-role'], { name: '{{context.kebab}}.change-member-roles' })
export class ChangeMemberRolesPolicy {
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.ManageMembers);
  }
}
