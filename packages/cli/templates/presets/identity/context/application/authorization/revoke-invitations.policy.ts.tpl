import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
import { Policy } from '@ddd-ts-kit/kernel/declarations';
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** An account takes back the invitations of an organisation where it may invite. */
@Policy({{context.camel}}Permissions['invitation.revoke'], { name: '{{context.kebab}}.revoke-invitations' })
export class RevokeInvitationsPolicy {
  appliesTo(subject: unknown): subject is OrganisationRights {
    return subject instanceof OrganisationRights;
  }

  allows(actor: Actor, rights: OrganisationRights): boolean {
    return isAuthenticated(actor) && rights.accountId === actor.id && rights.includes(MemberRight.InviteMembers);
  }
}
