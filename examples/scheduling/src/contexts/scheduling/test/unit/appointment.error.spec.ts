import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';

const startsAt = new Date('2026-03-02T09:00:00.000Z');

const refusals = [
  {
    refusal: AppointmentError.alreadyConfirmed('appointment-1'),
    code: 'APPOINTMENT_ALREADY_CONFIRMED',
    message: 'Appointment appointment-1 is booked: nothing is left to confirm.',
    facts: { appointmentId: 'appointment-1' },
    exposed: {},
  },
  {
    refusal: AppointmentError.ended('appointment-1', 'cancelled'),
    code: 'APPOINTMENT_ENDED',
    message: 'Appointment appointment-1 is cancelled and does not change any more.',
    facts: { appointmentId: 'appointment-1', status: 'cancelled' },
    exposed: { status: 'cancelled' },
  },
  {
    refusal: AppointmentError.notFound('appointment-1'),
    code: 'APPOINTMENT_NOT_FOUND',
    message: 'Appointment appointment-1 does not exist.',
    facts: { appointmentId: 'appointment-1' },
    exposed: {},
  },
  {
    refusal: AppointmentError.notStarted('appointment-1', startsAt),
    code: 'APPOINTMENT_NOT_STARTED',
    message: 'Appointment appointment-1 starts at 2026-03-02T09:00:00.000Z: its outcome is not known before.',
    facts: { appointmentId: 'appointment-1', startsAt },
    exposed: { startsAt },
  },
  {
    refusal: AppointmentError.bookingTooFar(129600),
    code: 'BOOKING_TOO_FAR',
    message: 'A slot is booked at most 129600 minutes before it starts.',
    facts: { horizon: 129600 },
    exposed: { horizon: 129600 },
  },
  {
    refusal: AppointmentError.bookingTooLate(120),
    code: 'BOOKING_TOO_LATE',
    message: 'A slot is booked at least 120 minutes before it starts.',
    facts: { notice: 120 },
    exposed: { notice: 120 },
  },
  {
    refusal: AppointmentError.invalidBooking('names no patient'),
    code: 'INVALID_BOOKING',
    message: 'A booking names no patient.',
    facts: { reason: 'names no patient' },
    exposed: {},
  },
  {
    refusal: AppointmentError.invalidSlot('ends before it starts'),
    code: 'INVALID_SLOT',
    message: 'A slot ends before it starts.',
    facts: { reason: 'ends before it starts' },
    exposed: {},
  },
  {
    refusal: AppointmentError.offGrid(15),
    code: 'OFF_GRID',
    message: 'An appointment of this type starts on a step of 15 minutes from midnight.',
    facts: { grid: 15 },
    exposed: { grid: 15 },
  },
  {
    refusal: AppointmentError.outsideAvailability(startsAt),
    code: 'OUTSIDE_AVAILABILITY',
    message: 'The calendar takes no appointment at 2026-03-02T09:00:00.000Z.',
    facts: { startsAt },
    exposed: { startsAt },
  },
  {
    refusal: AppointmentError.patientLimitReached(2),
    code: 'PATIENT_LIMIT_REACHED',
    message: 'The patient already holds 2 future appointments with this practitioner.',
    facts: { limit: 2 },
    exposed: { limit: 2 },
  },
  {
    refusal: AppointmentError.reasonRequired(),
    code: 'REASON_REQUIRED',
    message: 'The practice gives a reason when it cancels an appointment.',
    facts: {},
    exposed: {},
  },
  {
    refusal: AppointmentError.slotTaken('calendar-1', startsAt),
    code: 'SLOT_TAKEN',
    message: 'The slot starting at 2026-03-02T09:00:00.000Z on calendar calendar-1 is already held.',
    facts: { calendarId: 'calendar-1', startsAt },
    exposed: { startsAt },
  },
];

describe('AppointmentError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });

  it('refuses to read or remove the document of an appointment that holds none, keeping which appointment to itself', () => {
    const error = AppointmentError.noDocument('appointment-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NO_DOCUMENT');
    expect(error.message).toBe('Appointment appointment-1 holds no document.');
    expect([error.facts, error.exposedFacts]).toEqual([{ appointmentId: 'appointment-1' }, {}]);
  });

  it('refuses the name of a document longer than allowed, and says how long it may be', () => {
    const error = AppointmentError.documentNameTooLong(200);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DOCUMENT_NAME_TOO_LONG');
    expect(error.message).toBe('The name of a document holds at most 200 characters.');
    expect(error.exposedFacts).toEqual({ longest: 200 });
  });
});
