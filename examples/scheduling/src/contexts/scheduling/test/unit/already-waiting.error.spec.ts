import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AlreadyWaitingError } from '#src/contexts/scheduling/domain/errors/already-waiting.error.js';

describe('AlreadyWaitingError', () => {
  it('carries its stable code', () => {
    const error = new AlreadyWaitingError('patient-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('ALREADY_WAITING');
  });
});
