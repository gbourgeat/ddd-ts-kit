import { describe, expect, it } from '{{tests.module}}';
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

describe('Organisation rights', () => {
  it('holds each right once, whatever gave it twice', () => {
    const rights = OrganisationRights.of('acme', 'account-ada', [
      MemberRight.ReadMembers,
      MemberRight.InviteMembers,
      MemberRight.ReadMembers,
    ]);

    expect(rights.rights).toEqual([MemberRight.InviteMembers, MemberRight.ReadMembers]);
    expect(rights.includes(MemberRight.InviteMembers)).toBe(true);
    expect(rights.includes(MemberRight.ManageMembers)).toBe(false);
  });

  it('names the context as the resource the platform authorizes, for the account and the organisation it holds in', () => {
    const rights = OrganisationRights.of('acme', 'account-ada', []);

    expect(rights).toMatchObject({ type: 'context', id: '{{context.kebab}}', organisationId: 'acme', accountId: 'account-ada' });
  });
});
