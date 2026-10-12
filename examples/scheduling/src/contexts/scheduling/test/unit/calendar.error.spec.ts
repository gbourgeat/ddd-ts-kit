import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';

const refusals = [
  {
    refusal: CalendarError.invalidAppointmentType('lasts at least one minute'),
    code: 'INVALID_APPOINTMENT_TYPE',
    message: 'An appointment type lasts at least one minute.',
    facts: { rule: 'lasts at least one minute' },
    exposed: {},
  },
  {
    refusal: CalendarError.invalidBookingWindow('has a horizon after its notice'),
    code: 'INVALID_BOOKING_WINDOW',
    message: 'A booking window has a horizon after its notice.',
    facts: { rule: 'has a horizon after its notice' },
    exposed: {},
  },
  {
    refusal: CalendarError.invalidDay('2026-13-40'),
    code: 'INVALID_DAY',
    message: '2026-13-40 is not a day written YYYY-MM-DD.',
    facts: { day: '2026-13-40' },
    exposed: { day: '2026-13-40' },
  },
  {
    refusal: CalendarError.invalidRange('ends after it starts'),
    code: 'INVALID_RANGE',
    message: 'A range ends after it starts.',
    facts: { rule: 'ends after it starts' },
    exposed: {},
  },
  {
    refusal: CalendarError.invalidTimeOff('ends after it starts'),
    code: 'INVALID_TIME_OFF',
    message: 'A time off ends after it starts.',
    facts: { rule: 'ends after it starts' },
    exposed: {},
  },
  {
    refusal: CalendarError.timeOffOverAppointments(3),
    code: 'TIME_OFF_OVER_APPOINTMENTS',
    message: 'The time off covers 3 active appointment(s).',
    facts: { held: 3 },
    exposed: { held: 3 },
  },
  {
    refusal: CalendarError.unknownAppointmentType('surgery'),
    code: 'UNKNOWN_APPOINTMENT_TYPE',
    message: 'The calendar offers no appointment type surgery.',
    facts: { appointmentTypeId: 'surgery' },
    exposed: {},
  },
  {
    refusal: CalendarError.unknown('calendar-1'),
    code: 'UNKNOWN_CALENDAR',
    message: 'There is no calendar calendar-1.',
    facts: { calendarId: 'calendar-1' },
    exposed: {},
  },
  {
    refusal: CalendarError.unknownPractitioner('practice-1', 'person-1'),
    code: 'UNKNOWN_PRACTITIONER',
    message: 'The person person-1 is not a practitioner of the practice practice-1.',
    facts: { practiceId: 'practice-1', practitionerId: 'person-1' },
    exposed: {},
  },
  {
    refusal: CalendarError.unknownTimeZone('Mars/Olympus'),
    code: 'UNKNOWN_TIME_ZONE',
    message: 'Mars/Olympus is not a known time zone.',
    facts: { name: 'Mars/Olympus' },
    exposed: {},
  },
];

describe('CalendarError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });
});
