import { describe, expect, it } from '{{tests.module}}';
import { given } from '@ddd-ts-kit/testing';
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';

const joinedAt = new Date('2026-02-01T00:00:00.000Z');
const later = new Date('2026-02-02T00:00:00.000Z');
const byAnOwner = { by: MemberRole.Owner, byAccount: 'subject-owner', delegationId: undefined, owners: 2 };
const byAnAdmin = { by: MemberRole.Admin, byAccount: 'subject-admin', delegationId: undefined, owners: 2 };
const byAMember = { by: MemberRole.Member, byAccount: 'subject-member', delegationId: 'delegation-1', owners: 2 };

describe('Member', () => {
  it('joins an organisation in a role, and announces it', () => {
    const joined = Member.join(
      'member-1',
      { organisationId: 'acme', accountId: 'subject-ada', role: MemberRole.Admin },
      joinedAt,
    );

    expect(joined.isActive).toBe(true);

    expect(joined.pullEvents()).toEqual([
      {
        name: '{{context.kebab}}.member.joined',
        aggregateId: 'member-1',
        occurredAt: joinedAt,
        facts: { organisationId: 'acme', accountId: 'subject-ada', role: MemberRole.Admin },
      },
    ]);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = aMember().build();
    const loaded = Member.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });
});

describe('The role of a member', () => {
  it('changes, and the change is announced with the role it leaves', () => {
    given(aMember().identifiedBy('member-1').of('acme', 'subject-ada'))
      .when((member) => member.changeRole(MemberRole.Admin, byAnAdmin, later))
      .thenEvents([
        {
          name: '{{context.kebab}}.member.role-changed',
          facts: { organisationId: 'acme', accountId: 'subject-ada', from: MemberRole.Member, to: MemberRole.Admin },
        },
      ])
      .thenState((member) => expect(member.role).toBe(MemberRole.Admin));
  });

  it('stays as it is, silently, when it is asked again', () => {
    given(aMember().as(MemberRole.Admin))
      .when((member) => member.changeRole(MemberRole.Admin, byAnAdmin, later))
      .thenNoEvent();
  });

  it('becomes, or stops being, owner only by the decision of an owner', () => {
    given(aMember())
      .when((member) => member.changeRole(MemberRole.Owner, byAnAdmin, later))
      .thenError('OWNERS_ONLY');

    given(aMember().as(MemberRole.Owner))
      .when((member) => member.changeRole(MemberRole.Admin, byAnAdmin, later))
      .thenError('OWNERS_ONLY');

    given(aMember())
      .when((member) => member.changeRole(MemberRole.Owner, byAnOwner, later))
      .thenEventNames(['{{context.kebab}}.member.role-changed']);
  });

  it('stays owner when the organisation has no other owner', () => {
    given(aMember().as(MemberRole.Owner))
      .when((member) => member.changeRole(MemberRole.Admin, { ...byAnOwner, owners: 1 }, later))
      .thenError('LAST_OWNER');
  });

  it('is never changed by the member themselves, nor above the role of who decides', () => {
    given(aMember().of('acme', 'subject-ada').as(MemberRole.Admin))
      .when((member) => member.changeRole(MemberRole.Member, { ...byAnOwner, byAccount: 'subject-ada' }, later))
      .thenError('OWN_ROLE');

    given(aMember())
      .when((member) => member.changeRole(MemberRole.Admin, byAMember, later))
      .thenError('ABOVE_OWN_ROLE');

    given(aMember().as(MemberRole.Admin))
      .when((member) => member.changeRole(MemberRole.Member, byAMember, later))
      .thenError('ABOVE_OWN_ROLE');
  });
});

describe('A member', () => {
  it('is removed, and the removal is announced', () => {
    given(aMember().identifiedBy('member-1').of('acme', 'subject-ada'))
      .when((member) => member.remove(byAnAdmin, later))
      .thenEvents([{ name: '{{context.kebab}}.member.removed', facts: { organisationId: 'acme', accountId: 'subject-ada' } }])
      .thenState((member) => expect(member.isActive).toBe(false));
  });

  it('who owns the organisation is removed by an owner only, and never when they are its last owner', () => {
    given(aMember().as(MemberRole.Owner))
      .when((member) => member.remove(byAnAdmin, later))
      .thenError('OWNERS_ONLY');

    given(aMember().as(MemberRole.Owner))
      .when((member) => member.remove({ ...byAnOwner, owners: 1 }, later))
      .thenError('LAST_OWNER');
  });

  it('leaves by themselves, and is removed by no one below their role; the delegation used is named', () => {
    given(aMember().of('acme', 'subject-ada').as(MemberRole.Admin))
      .when((member) => member.remove({ ...byAMember, byAccount: 'subject-ada', by: MemberRole.Admin }, later))
      .thenEventNames(['{{context.kebab}}.member.removed']);

    given(aMember().as(MemberRole.Admin))
      .when((member) => member.remove(byAMember, later))
      .thenError('ABOVE_OWN_ROLE');

    given(aMember().of('acme', 'subject-irene'))
      .when((member) => member.remove(byAMember, later))
      .thenEvents([
        {
          name: '{{context.kebab}}.member.removed',
          facts: { organisationId: 'acme', accountId: 'subject-irene', delegationId: 'delegation-1' },
        },
      ]);
  });

  it('who was removed is not found any more', () => {
    given(aMember().removedAt(joinedAt))
      .when((member) => member.remove(byAnOwner, later))
      .thenError('MEMBER_NOT_FOUND');

    given(aMember().removedAt(joinedAt))
      .when((member) => member.changeRole(MemberRole.Admin, byAnOwner, later))
      .thenError('MEMBER_NOT_FOUND');
  });
});
