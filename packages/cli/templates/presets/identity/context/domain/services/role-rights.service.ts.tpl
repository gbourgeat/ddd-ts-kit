import type { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** What each role grants. Changing a role here changes what every member of that role may do. */
const GRANTED: Readonly<Record<MemberRole, readonly MemberRight[]>> = {
  [MemberRole.Owner]: [
    MemberRight.ReadMembers,
    MemberRight.InviteMembers,
    MemberRight.ManageMembers,
    MemberRight.GrantDelegations,
  ],
  [MemberRole.Admin]: [MemberRight.ReadMembers, MemberRight.InviteMembers, MemberRight.ManageMembers],
  [MemberRole.Member]: [MemberRight.ReadMembers],
};

/** The rights of the roles, and what an account may do in an organisation once its delegations are counted. */
export class RoleRightsService {
  rightsOf(role: MemberRole): readonly MemberRight[] {
    return GRANTED[role];
  }

  /**
   * The rights of an account in an organisation at `now`: none without a membership, those of its
   * role otherwise, plus those every delegation active at `now` lends it there.
   */
  rightsIn(
    organisationId: string,
    accountId: string,
    held: { readonly member: Member | undefined; readonly lent: readonly Delegation[]; readonly now: Date },
  ): OrganisationRights {
    if (!held.member?.isActive) {
      return OrganisationRights.of(organisationId, accountId, []);
    }

    const lent = held.lent.filter((delegation) => delegation.isActiveAt(held.now)).flatMap((given) => given.rights);

    return OrganisationRights.of(organisationId, accountId, [...GRANTED[held.member.role], ...lent]);
  }
}
