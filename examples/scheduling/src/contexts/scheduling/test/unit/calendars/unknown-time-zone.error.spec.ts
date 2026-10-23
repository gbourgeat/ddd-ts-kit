import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownTimeZone } from '@/contexts/scheduling/calendars/domain/errors/unknown-time-zone.error';

describe('UnknownTimeZone', () => {
  it('refuses with the code UNKNOWN_TIME_ZONE, its message and its facts', () => {
    const error = UnknownTimeZone.forName('Mars/Olympus');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_TIME_ZONE');
    expect(error.message).toBe('Mars/Olympus is not a known time zone.');
    expect(error.facts).toEqual({ name: 'Mars/Olympus' });
    expect(error.exposedFacts).toEqual({});
  });
});
