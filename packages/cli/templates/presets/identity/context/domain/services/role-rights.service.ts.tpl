import type { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
import type { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
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

/** What an account holds in an organisation at an instant: its membership, the delegations lent to it. */
export interface HeldRights {
  readonly member: Member | undefined;
  readonly lent: readonly Delegation[];
  readonly now: Date;
}

/** The rights of the roles, and what an account may do in an organisation once its delegations are counted. */
export class RoleRightsService {
  rightsOf(role: MemberRole): readonly MemberRight[] {
    return GRANTED[role];
  }

  /**
   * The rights of an account in an organisation at `now`: none without a current membership (a
   * member removed, or whose account was deactivated, which ends its memberships), those of its
   * role otherwise, plus those every delegation active at `now` lends it there.
   */
  rightsIn(organisationId: string, accountId: string, held: HeldRights): OrganisationRights {
    if (!held.member?.isActive) {
      return OrganisationRights.of(organisationId, accountId, []);
    }

    const lent = activeAt(held).flatMap((given) => given.rights);

    return OrganisationRights.of(organisationId, accountId, [...GRANTED[held.member.role], ...lent]);
  }

  /**
   * Whether the account that issued `invitation`, as it holds at `now` (`held`), may still issue it:
   * the right to invite, from its role or lent, and a role of its own at or above the one of the
   * invitation. Removed, deactivated, demoted or no longer lent the right, its pending invitations
   * are withdrawn: they let nobody in.
   */
  mayStillIssue(invitation: Invitation, held: HeldRights): boolean {
    const { organisationId, invitedBy, role } = invitation;
    const inviting = this.rightsIn(organisationId, invitedBy, held).includes(MemberRight.InviteMembers);

    return inviting && held.member !== undefined && Member.mayAppoint(role, held.member.role);
  }

  /** The delegation `right` is used under, when the role of the member does not grant it: what the facts it leads to name. */
  delegationUsedFor(right: MemberRight, held: HeldRights): string | undefined {
    if (held.member === undefined || GRANTED[held.member.role].includes(right)) {
      return undefined;
    }

    return activeAt(held).find((given) => given.rights.includes(right))?.id;
  }
}

function activeAt(held: HeldRights): readonly Delegation[] {
  return held.lent.filter((delegation) => delegation.isActiveAt(held.now));
}
