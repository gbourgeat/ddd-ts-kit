import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { ReminderError } from '@/contexts/notification/domain/errors/reminder.error';

const refusals = [
  {
    refusal: ReminderError.notDue('reminder-1'),
    code: 'REMINDER_NOT_DUE',
    message:
      'The reminder reminder-1 is not due: it is sent once, from 24 hours before the start until the start, and only while it is planned.',
    facts: { reminderId: 'reminder-1' },
    exposed: {},
  },
];

describe('ReminderError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });
});
