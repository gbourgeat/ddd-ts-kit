import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationError } from '@/contexts/identity/domain/errors/delegation.error';

const endsAt = new Date('2026-03-02T09:00:00.000Z');

const refusals = [
  {
    refusal: DelegationError.alreadyActive('delegation-1'),
    code: 'DELEGATION_ALREADY_ACTIVE',
    message: 'This practitioner already delegates to this assistant (delegation delegation-1).',
    facts: { delegationId: 'delegation-1' },
    exposed: {},
  },
  {
    refusal: DelegationError.endsInThePast(endsAt),
    code: 'DELEGATION_ENDS_IN_THE_PAST',
    message: 'A delegation cannot end in the past (2026-03-02T09:00:00.000Z).',
    facts: { endsAt },
    exposed: { endsAt },
  },
  {
    refusal: DelegationError.notActive('delegation-1'),
    code: 'DELEGATION_NOT_ACTIVE',
    message: 'The delegation delegation-1 already ended.',
    facts: { delegationId: 'delegation-1' },
    exposed: {},
  },
  {
    refusal: DelegationError.notFound('delegation-1'),
    code: 'DELEGATION_NOT_FOUND',
    message: 'The delegation delegation-1 does not exist on this desk.',
    facts: { delegationId: 'delegation-1' },
    exposed: {},
  },
];

describe('DelegationError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });
});
