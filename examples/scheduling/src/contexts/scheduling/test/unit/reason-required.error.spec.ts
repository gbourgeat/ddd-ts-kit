import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { ReasonRequiredError } from '@/contexts/scheduling/domain/errors/reason-required.error';

describe('ReasonRequiredError', () => {
  it('carries its stable code', () => {
    const error = new ReasonRequiredError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('REASON_REQUIRED');
    expect(error.message).toBe('The practice gives a reason when it cancels an appointment.');
  });
});
