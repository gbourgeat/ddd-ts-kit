import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownCalendarError } from '@/contexts/scheduling/domain/errors/unknown-calendar.error.js';

describe('UnknownCalendarError', () => {
  it('carries its stable code', () => {
    const error = new UnknownCalendarError('calendar-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_CALENDAR');
  });
});
