import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { ReminderNotDue } from '@/contexts/notification/domain/errors/reminder-not-due.error';

describe('ReminderNotDue', () => {
  it('refuses with the code REMINDER_NOT_DUE, its message and its facts', () => {
    const error = ReminderNotDue.forReminder('reminder-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('REMINDER_NOT_DUE');

    expect(error.message).toBe(
      'The reminder reminder-1 is not due: it is sent once, from 24 hours before the start until the start, and only while it is planned.',
    );

    expect(error.facts).toEqual({ reminderId: 'reminder-1' });
    expect(error.exposedFacts).toEqual({});
  });
});
