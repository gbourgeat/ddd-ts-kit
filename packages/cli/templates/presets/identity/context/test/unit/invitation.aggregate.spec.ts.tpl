import { describe, expect, it } from '{{tests.module}}';
import { given } from '@ddd-ts-kit/testing';
import { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { InvitationStatus } from '{{alias.context}}/domain/vocabularies/invitation-status.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { anInvitation } from '{{alias.context}}/test/builders/invitation.builder{{alias.ext}}';

const issuedAt = new Date('2026-02-01T00:00:00.000Z');
const nextDay = new Date('2026-02-02T00:00:00.000Z');
const weekLater = new Date('2026-02-08T00:00:00.000Z');
const grace = { id: 'subject-grace', email: EmailAddress.create('grace@example.test') };
const someoneElse = { id: 'subject-alan', email: EmailAddress.create('alan@example.test') };

describe('Invitation', () => {
  it('is issued to an address, in a role, for a week, keeping the digest of its token only', () => {
    const terms = {
      organisationId: 'acme',
      email: grace.email,
      role: MemberRole.Admin,
      tokenHash: 'digest',
      invitedBy: 'subject-ada',
    };

    const invitation = Invitation.issue('invitation-1', terms, issuedAt);

    expect(invitation.status).toBe(InvitationStatus.Pending);
    expect(invitation.expiresAt).toEqual(weekLater);

    expect(invitation.pullEvents()).toEqual([
      {
        name: '{{context.kebab}}.invitation.issued',
        aggregateId: 'invitation-1',
        occurredAt: issuedAt,
        facts: { organisationId: 'acme', email: 'grace@example.test', role: MemberRole.Admin, expiresAt: weekLater },
      },
    ]);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = anInvitation().build();
    const loaded = Invitation.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });
});

describe('A pending invitation', () => {
  it('is accepted by the person it is addressed to, before it expires', () => {
    given(anInvitation().identifiedBy('invitation-1').to('acme').issuedAt(issuedAt))
      .when((invitation) => invitation.accept(grace, nextDay))
      .thenEvents([
        {
          name: '{{context.kebab}}.invitation.accepted',
          aggregateId: 'invitation-1',
          facts: { organisationId: 'acme', accountId: 'subject-grace' },
        },
      ])
      .thenState((invitation) => expect(invitation.status).toBe(InvitationStatus.Accepted));
  });

  it('is declined by the person it is addressed to', () => {
    given(anInvitation().issuedAt(issuedAt))
      .when((invitation) => invitation.decline(grace, nextDay))
      .thenEventNames(['{{context.kebab}}.invitation.declined'])
      .thenState((invitation) => expect(invitation.status).toBe(InvitationStatus.Declined));
  });

  it('is answered by nobody else', () => {
    given(anInvitation().issuedAt(issuedAt))
      .when((invitation) => invitation.accept(someoneElse, nextDay))
      .thenError('INVITATION_ADDRESSED_TO_ANOTHER');

    given(anInvitation().issuedAt(issuedAt))
      .when((invitation) => invitation.decline(someoneElse, nextDay))
      .thenError('INVITATION_ADDRESSED_TO_ANOTHER');
  });

  it('is answered no more once its week is over', () => {
    given(anInvitation().issuedAt(issuedAt))
      .when((invitation) => invitation.accept(grace, weekLater))
      .thenError('INVITATION_EXPIRED', { expiresAt: weekLater });
  });

  it('is taken back by the organisation, expired or not', () => {
    given(anInvitation().issuedAt(issuedAt))
      .when((invitation) => invitation.revoke(new Date('2026-03-01T00:00:00.000Z')))
      .thenEventNames(['{{context.kebab}}.invitation.revoked'])
      .thenState((invitation) => expect(invitation.status).toBe(InvitationStatus.Revoked));
  });
});

describe('An answered invitation', () => {
  it('is answered once', () => {
    const accepted = () => {
      const invitation = anInvitation().issuedAt(issuedAt).build();

      invitation.accept(grace, nextDay);

      return invitation;
    };

    given(accepted())
      .when((invitation) => invitation.accept(grace, nextDay))
      .thenError('INVITATION_NOT_PENDING', {
        status: InvitationStatus.Accepted,
      });

    given(accepted())
      .when((invitation) => invitation.decline(grace, nextDay))
      .thenError('INVITATION_NOT_PENDING');

    given(accepted())
      .when((invitation) => invitation.revoke(nextDay))
      .thenError('INVITATION_NOT_PENDING');
  });
});
