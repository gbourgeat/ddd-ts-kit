import { describe, expect, it } from 'vitest';
import type { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate.js';
import { SchedulerService } from '@/contexts/scheduling/domain/services/scheduler.service.js';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder.js';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder.js';

// Monday 2 March 2026 in Europe/Paris is UTC+1: 09:00 on the wall clock is 08:00Z.
const now = new Date('2026-03-01T08:00:00.000Z');
const scheduler = new SchedulerService();

const calendar = aCalendar()
  .identifiedBy('calendar-a')
  .ofPractitioner('practitioner-a', 'practice-a')
  .openEveryDay(['09:00', '12:00'], ['14:00', '18:00'])
  .offering('consultation', { buffer: 10 })
  .offering('first-visit', { needsConfirmation: true })
  .build();

const nothing = { onCalendar: [], byPatient: [] };

describe('SchedulerService', () => {
  it('holds no state of its own', () => {
    expect(Object.keys(new SchedulerService())).toEqual([]);
  });

  it('books a free slot of the calendar for the patient, on the day of the practice', () => {
    const booked = scheduler.book(wishAt('08:00'), calendar, nothing);

    expect(booked.id).toBe('appointment-new');
    expect(booked.status).toBe('booked');

    expect(booked.booking).toMatchObject({
      calendarId: 'calendar-a',
      practiceId: 'practice-a',
      practitionerId: 'practitioner-a',
      patientId: 'patient-a',
      appointmentTypeId: 'consultation',
      day: '2026-03-02',
    });

    expect(booked.slot.startsAt).toEqual(at('08:00'));
    expect(booked.slot.endsAt).toEqual(at('08:30'));
    expect(booked.slot.heldUntil).toEqual(at('08:40'));
    expect(booked.pullEvents()).toMatchObject([{ name: 'scheduling.appointment.booked', occurredAt: now }]);
  });

  it('names the day of the practice, not the one of the instant, for a slot late in the evening', () => {
    const late = aCalendar().openEveryDay(['00:00', '02:00']).offering('consultation').build();

    const booked = scheduler.book(
      {
        id: 'appointment-new',
        patientId: 'patient-a',
        appointmentTypeId: 'consultation',
        startsAt: new Date('2026-03-02T23:30:00.000Z'),
        now,
      },
      late,
      nothing,
    );

    expect(booked.booking.day).toBe('2026-03-03');
  });

  it('requests the appointment, with its deadline, when the type needs a confirmation', () => {
    const requested = scheduler.book(wishAt('08:00', 'first-visit'), calendar, nothing);

    expect(requested.status).toBe('requested');
    expect(requested.confirmBefore).toEqual(calendar.confirmationDeadlineFor('first-visit', now));
    expect(requested.confirmBefore?.getTime()).toBeGreaterThan(now.getTime());
  });

  it('refuses a start the calendar is not open on', () => {
    expect(errorOf(() => scheduler.book(wishAt('12:00'), calendar, nothing))).toMatchObject({
      code: 'OUTSIDE_AVAILABILITY',
    });
  });

  it('refuses a start that is not on the grid of the type', () => {
    expect(errorOf(() => scheduler.book(wishAt('08:10'), calendar, nothing))).toMatchObject({ code: 'OFF_GRID' });
  });
});

describe('SchedulerService, on a calendar that holds appointments', () => {
  it('refuses a slot an active appointment already holds', () => {
    const held = { onCalendar: [heldAt('08:00').build()], byPatient: [] };

    expect(errorOf(() => scheduler.book(wishAt('08:00'), calendar, held))).toMatchObject({ code: 'SLOT_TAKEN' });
  });

  it('refuses a slot that starts in the buffer of the appointment before it', () => {
    const held = { onCalendar: [heldAt('08:00').lasting(30).withBuffer(10).build()], byPatient: [] };

    expect(errorOf(() => scheduler.book(wishAt('08:30'), calendar, held))).toMatchObject({ code: 'SLOT_TAKEN' });
  });

  it('refuses a slot whose own buffer runs into the next appointment', () => {
    const held = { onCalendar: [heldAt('09:30').build()], byPatient: [] };

    expect(errorOf(() => scheduler.book(wishAt('09:00'), calendar, held))).toMatchObject({ code: 'SLOT_TAKEN' });
  });

  it.each([
    ['cancelled', heldAt('08:00').cancelledByPatient()],
    ['expired', heldAt('08:00').expired()],
  ])('books a slot whose previous appointment was %s', (_end, previous) => {
    const booked = scheduler.book(wishAt('08:00'), calendar, { onCalendar: [previous.build()], byPatient: [] });

    expect(booked.status).toBe('booked');
  });
});

describe('SchedulerService, limiting the future appointments of a patient', () => {
  it('books the last appointment the limit of the calendar allows a patient', () => {
    const coming: Appointment[] = [
      heldAt('13:00').forPatient('patient-a').build(),
      heldAt('14:00').forPatient('patient-a').build(),
    ];

    const booked = scheduler.book(wishAt('08:00'), calendar, { onCalendar: [], byPatient: coming });

    expect(calendar.limit).toBe(3);
    expect(booked.status).toBe('booked');
  });

  it('refuses one appointment more than the limit of future appointments of a patient with the practitioner', () => {
    const coming = [heldAt('13:00'), heldAt('14:00'), heldAt('15:00')].map((builder) =>
      builder.forPatient('patient-a').build(),
    );

    expect(
      errorOf(() => scheduler.book(wishAt('08:00'), calendar, { onCalendar: [], byPatient: coming })),
    ).toMatchObject({ code: 'PATIENT_LIMIT_REACHED' });
  });

  it('counts neither the past, nor the ended, nor the appointments with another practitioner towards the limit', () => {
    const past = anAppointment()
      .withPractitioner('practitioner-a')
      .forPatient('patient-a')
      .startingAt(new Date('2026-02-20T08:00:00.000Z'))
      .build();

    const cancelled = heldAt('13:00').forPatient('patient-a').cancelledByPatient().build();

    const elsewhere = anAppointment()
      .withPractitioner('practitioner-b')
      .forPatient('patient-a')
      .startingAt(at('13:00'))
      .build();

    const coming = [heldAt('14:00'), heldAt('15:00')].map((builder) => builder.forPatient('patient-a').build());

    const booked = scheduler.book(wishAt('08:00'), calendar, {
      onCalendar: [],
      byPatient: [past, cancelled, elsewhere, ...coming],
    });

    expect(booked.status).toBe('booked');
  });
});

describe('SchedulerService, moving an appointment', () => {
  it('moves an appointment to another free slot of its calendar', () => {
    const appointment = heldAt('08:00').forPatient('patient-a').build();

    appointment.pullEvents();

    scheduler.reschedule({ appointment, startsAt: at('14:00'), now }, calendar, {
      onCalendar: [appointment],
      byPatient: [appointment],
    });

    expect(appointment.slot.startsAt).toEqual(at('14:00'));
    expect(appointment.slot.heldUntil).toEqual(at('14:40'));
    expect(appointment.pullEvents()).toMatchObject([{ name: 'scheduling.appointment.rescheduled' }]);
  });

  it('lets an appointment move onto a part of the time it holds itself', () => {
    const appointment = heldAt('08:00').lasting(60).forPatient('patient-a').build();

    scheduler.reschedule({ appointment, startsAt: at('08:30'), now }, calendar, {
      onCalendar: [appointment],
      byPatient: [appointment],
    });

    expect(appointment.slot.startsAt).toEqual(at('08:30'));
  });

  it('does not count the appointment itself towards the limit when it moves', () => {
    const appointment = heldAt('08:00').forPatient('patient-a').build();

    const coming = [
      appointment,
      heldAt('14:00').forPatient('patient-a').build(),
      heldAt('15:00').forPatient('patient-a').build(),
    ];

    scheduler.reschedule({ appointment, startsAt: at('09:00'), now }, calendar, {
      onCalendar: [appointment],
      byPatient: coming,
    });

    expect(appointment.slot.startsAt).toEqual(at('09:00'));
  });

  it('refuses to move an appointment onto a slot another one holds, and leaves it where it was', () => {
    const appointment = heldAt('08:00').forPatient('patient-a').build();
    const other = heldAt('14:00').build();

    appointment.pullEvents();

    const refusal = errorOf(() =>
      scheduler.reschedule({ appointment, startsAt: at('14:00'), now }, calendar, {
        onCalendar: [appointment, other],
        byPatient: [appointment],
      }),
    );

    expect(refusal).toMatchObject({ code: 'SLOT_TAKEN' });
    expect(appointment.slot.startsAt).toEqual(at('08:00'));
    expect(appointment.pullEvents()).toEqual([]);
  });

  it('refuses to move an appointment outside the availability of its calendar', () => {
    const appointment = heldAt('08:00').forPatient('patient-a').build();

    const refusal = errorOf(() =>
      scheduler.reschedule({ appointment, startsAt: at('12:00'), now }, calendar, {
        onCalendar: [appointment],
        byPatient: [appointment],
      }),
    );

    expect(refusal).toMatchObject({ code: 'OUTSIDE_AVAILABILITY' });
  });

  it('refuses to move an ended appointment', () => {
    const appointment = heldAt('08:00').forPatient('patient-a').cancelledByPatient().build();

    const refusal = errorOf(() => scheduler.reschedule({ appointment, startsAt: at('14:00'), now }, calendar, nothing));

    expect(refusal).toMatchObject({ code: 'APPOINTMENT_ENDED' });
  });
});

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}

function wishAt(time: string, appointmentTypeId = 'consultation') {
  return { id: 'appointment-new', patientId: 'patient-a', appointmentTypeId, startsAt: at(time), now };
}

function heldAt(time: string) {
  return anAppointment().onCalendar('calendar-a').withPractitioner('practitioner-a').startingAt(at(time));
}

function errorOf(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  return undefined;
}
