import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownTimeZoneError } from '@/contexts/scheduling/domain/errors/unknown-time-zone.error.js';

describe('UnknownTimeZoneError', () => {
  it('carries its stable code', () => {
    const error = new UnknownTimeZoneError('Mars/Olympus');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_TIME_ZONE');
  });
});
