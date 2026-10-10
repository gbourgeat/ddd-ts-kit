import { describe, expect, it } from 'vitest';
import { given } from '@ddd-ts-kit/testing';
import { Delegation } from '#src/contexts/identity/domain/aggregates/delegation.aggregate.js';
import { DelegationEndsInThePastError } from '#src/contexts/identity/domain/errors/delegation-ends-in-the-past.error.js';
import { DelegationNotActiveError } from '#src/contexts/identity/domain/errors/delegation-not-active.error.js';
import { Desk } from '#src/contexts/identity/domain/value-objects/desk.vo.js';
import { aDelegation } from '#src/contexts/identity/test/builders/delegation.builder.js';

const grantedAt = new Date('2026-03-01T00:00:00.000Z');
const end = new Date('2026-04-01T00:00:00.000Z');
const later = new Date('2026-03-15T00:00:00.000Z');

describe('Delegation', () => {
  it('is born with its identity', () => {
    const born = aDelegation().identifiedBy('delegation-7').bornAt(grantedAt).build();

    expect(born.id).toBe('delegation-7');
    expect(born.registeredAt).toEqual(grantedAt);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = aDelegation().build();

    const loaded = Delegation.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('is granted on a desk to an assistant, active, and announces its terms', () => {
    const granted = aDelegation()
      .identifiedBy('delegation-7')
      .onDesk('practice-1', 'person-2')
      .givenTo('person-3')
      .includingAvailability()
      .endingAt(end)
      .bornAt(grantedAt)
      .build();

    expect(granted.isActive).toBe(true);

    expect(granted.pullEvents()).toEqual([
      {
        name: 'identity.delegation.granted',
        aggregateId: 'delegation-7',
        occurredAt: grantedAt,
        facts: {
          practiceId: 'practice-1',
          practitionerId: 'person-2',
          assistantId: 'person-3',
          availabilityIncluded: true,
          endsAt: end,
        },
      },
    ]);
  });

  it.each([new Date('2026-02-28T23:59:59.000Z'), grantedAt])(
    'refuses to be granted until %s, which is not after the moment it is granted',
    (endsAt) => {
      const terms = {
        desk: Desk.create('practice-1', 'person-2'),
        assistantId: 'person-3',
        availabilityIncluded: false,
        endsAt,
      };

      expect(() => Delegation.create('delegation-7', terms, grantedAt)).toThrow(DelegationEndsInThePastError);
    },
  );
});

describe('A granted delegation', () => {
  it('is revoked before its end and announces why it ended', () => {
    given(aDelegation().identifiedBy('delegation-7').onDesk('practice-1', 'person-2').givenTo('person-3'))
      .when((delegation) => delegation.revoke(later))
      .thenEvents([
        {
          name: 'identity.delegation.revoked',
          aggregateId: 'delegation-7',
          occurredAt: later,
          facts: { practiceId: 'practice-1', practitionerId: 'person-2', assistantId: 'person-3', cause: 'revoked' },
        },
      ])
      .thenState((delegation) => expect(delegation.isActive).toBe(false));
  });

  it('refuses to be revoked twice', () => {
    given(aDelegation().revokedAt(later))
      .when((delegation) => delegation.revoke(later))
      .thenError(DelegationNotActiveError, 'DELEGATION_NOT_ACTIVE');
  });

  it('expires once its end is reached, at the instant it is asked for', () => {
    given(aDelegation().bornAt(grantedAt).endingAt(end))
      .when((delegation) => delegation.expire(end))
      .thenEvents([{ name: 'identity.delegation.revoked', occurredAt: end, facts: { cause: 'expired' } }])
      .thenState((delegation) => expect(delegation.isActive).toBe(false));
  });

  it('does not expire before its end', () => {
    given(aDelegation().bornAt(grantedAt).endingAt(end))
      .when((delegation) => delegation.expire(later))
      .thenNoEvent()
      .thenState((delegation) => expect(delegation.isActive).toBe(true));
  });

  it('never expires when it has no end', () => {
    given(aDelegation().bornAt(grantedAt))
      .when((delegation) => delegation.expire(new Date('2036-01-01T00:00:00.000Z')))
      .thenNoEvent();
  });

  it('expires once: asked again, nothing happens', () => {
    given(aDelegation().bornAt(grantedAt).endingAt(end).revokedAt(later))
      .when((delegation) => delegation.expire(end))
      .thenNoEvent();
  });

  it('ends with the membership of one of its two members', () => {
    given(aDelegation())
      .when((delegation) => delegation.endWithMembership(later))
      .thenEvents([{ name: 'identity.delegation.revoked', occurredAt: later, facts: { cause: 'member-removed' } }]);
  });

  it('stays as it ended when a membership ends afterwards', () => {
    given(aDelegation().revokedAt(later))
      .when((delegation) => delegation.endWithMembership(later))
      .thenNoEvent();
  });

  it('says on which desk it was given', () => {
    const delegation = aDelegation().onDesk('practice-1', 'person-2').build();

    expect(delegation.isOn(Desk.create('practice-1', 'person-2'))).toBe(true);
    expect(delegation.isOn(Desk.create('practice-1', 'person-9'))).toBe(false);
  });
});
