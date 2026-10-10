import { describe, expect, it } from 'vitest';
import { DelegationRevoked } from '../../domain/events/delegation-revoked.event.js';

describe('DelegationRevoked', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new DelegationRevoked('delegation-1', new Date('2026-01-01T00:00:00.000Z'), { practiceId: 'practice-1', practitionerId: 'person-2', assistantId: 'person-3', cause: 'expired' });

    expect(event.name).toBe('identity.delegation.revoked');
    expect(event.aggregateId).toBe('delegation-1');
  });
});
