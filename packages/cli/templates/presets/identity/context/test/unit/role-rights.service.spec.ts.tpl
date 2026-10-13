import { describe, expect, it } from '{{tests.module}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';

const now = new Date('2026-01-10T00:00:00.000Z');

describe('RoleRightsService', () => {
  it('grants every right to an owner, all but delegation to an admin, the reading of members to a member', () => {
    expect(new RoleRightsService().rightsOf(MemberRole.Owner)).toEqual(Object.values(MemberRight));
    expect(new RoleRightsService().rightsOf(MemberRole.Admin)).not.toContain(MemberRight.GrantDelegations);
    expect(new RoleRightsService().rightsOf(MemberRole.Member)).toEqual([MemberRight.ReadMembers]);
  });

  it('gives an account no right in an organisation it is not, or no longer, a member of', () => {
    const removed = aMember().of('acme', 'account-ada').as(MemberRole.Owner).removedAt(now).build();

    expect(
      new RoleRightsService().rightsIn('acme', 'account-ada', { member: undefined, lent: [], now }).rights,
    ).toEqual([]);

    expect(new RoleRightsService().rightsIn('acme', 'account-ada', { member: removed, lent: [], now }).rights).toEqual(
      [],
    );
  });

  it('adds to the rights of the role those an active delegation lends, and nothing of one that ended', () => {
    const member = aMember().of('acme', 'account-deputy').build();
    const active = aDelegation().to('account-deputy').lending(MemberRight.InviteMembers).build();

    const ended = aDelegation()
      .to('account-deputy')
      .lending(MemberRight.ManageMembers)
      .between(new Date('2025-12-01T00:00:00.000Z'), new Date('2026-01-05T00:00:00.000Z'))
      .build();

    const rights = new RoleRightsService().rightsIn('acme', 'account-deputy', { member, lent: [active, ended], now });

    expect(rights.rights).toEqual([MemberRight.InviteMembers, MemberRight.ReadMembers]);
  });

  it('names the delegation a right is used under when the role does not grant it, and none otherwise', () => {
    const deputy = aMember().of('acme', 'account-deputy').build();
    const admin = aMember().of('acme', 'account-admin').as(MemberRole.Admin).build();
    const lent = [aDelegation().identifiedBy('delegation-1').lending(MemberRight.InviteMembers).build()];
    const rights = new RoleRightsService();

    expect(rights.delegationUsedFor(MemberRight.InviteMembers, { member: deputy, lent, now })).toBe('delegation-1');
    expect(rights.delegationUsedFor(MemberRight.InviteMembers, { member: admin, lent, now })).toBeUndefined();
    expect(rights.delegationUsedFor(MemberRight.ManageMembers, { member: deputy, lent, now })).toBeUndefined();
  });
});
