import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { ReasonRequired } from '@/contexts/scheduling/domain/calendars/errors/reason-required.error';

describe('ReasonRequired', () => {
  it('refuses with the code REASON_REQUIRED, its message and its facts', () => {
    const error = ReasonRequired.onCancellation();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('REASON_REQUIRED');
    expect(error.message).toBe('The practice gives a reason when it cancels an appointment.');
    expect(error.facts).toEqual({});
    expect(error.exposedFacts).toEqual({});
  });
});
