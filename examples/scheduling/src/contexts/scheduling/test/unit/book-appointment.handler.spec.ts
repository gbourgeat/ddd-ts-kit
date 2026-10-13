import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { BookAppointmentCommand } from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command';
import { SchedulingRelationships } from '@/contexts/scheduling/application/ports/scheduling-relationships.port';
import type { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';
import { FakeSchedulingRelationships } from '@/contexts/scheduling/test/fakes/scheduling-relationships.fake';
import { Agenda } from '@/contexts/scheduling/application/ports/agenda.port';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: {
      holder: [schedulingPermissions['appointment.book']],
      runner: [schedulingPermissions['appointment.book'], schedulingPermissions['appointment.note.write']],
    },
  }),
});

const holder = anActor().withRole('holder').build();
/** Who runs the calendar: books, and writes the internal note. */
const runner = anActor().withRole('runner').build();
// Monday 2 March 2026 in Europe/Paris is UTC+1: 09:00 on the wall clock is 08:00Z.
const NOW = new Date('2026-03-01T08:00:00.000Z');

describe('Book appointment', () => {
  it('holds the slot for the patient and answers the identifier of the appointment', async () => {
    const { application, appointmentRepository } = await arrange();

    const id = await application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', wish('08:00')));

    const stored = await appointmentRepository.findById(id);

    expect(id).toBe('appointment-1');
    expect(stored?.status).toBe('booked');

    expect(stored?.booking).toMatchObject({
      calendarId: 'calendar-a',
      practiceId: 'practice-a',
      practitionerId: 'practitioner-a',
      patientId: 'patient-1',
      day: '2026-03-02',
    });

    expect(stored?.slot.heldUntil).toEqual(at('08:40'));
  });

  it('announces the booking inside the context and to the other contexts', async () => {
    const { application, announced } = await arrange();

    await application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', wish('08:00')));

    expect(announced).toEqual(['scheduling.appointment.booked']);

    expect(application.eventBus.published).toMatchObject([
      {
        type: 'scheduling.appointment.booked',
        occurredAt: NOW.toISOString(),
        payload: {
          appointmentId: 'appointment-1',
          startsAt: '2026-03-02T08:00:00.000Z',
          endsAt: '2026-03-02T08:30:00.000Z',
          status: 'booked',
        },
      },
    ]);
  });

  it('records whose appointment it is and on which calendar, with the save', async () => {
    const { application, relationships } = await arrange();

    await application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', wish('08:00')));

    expect(relationships.current).toEqual([
      'appointment appointment-1 of patient patient-1',
      'appointment appointment-1 on calendar calendar-a',
    ]);
  });

  it('requests the appointment, with its deadline, when its type needs a confirmation', async () => {
    const { application, appointmentRepository } = await arrange();

    const id = await application.commandBus.execute(
      new BookAppointmentCommand(holder, 'calendar-a', wish('08:00', 'first-visit')),
    );

    const stored = await appointmentRepository.findById(id);

    expect(stored?.status).toBe('requested');
    expect(stored?.confirmBefore?.getTime()).toBeGreaterThan(NOW.getTime());

    expect(application.eventBus.published).toMatchObject([
      { payload: { status: 'requested', confirmBefore: stored?.confirmBefore?.toISOString() } },
    ]);
  });

  it('is refused to an actor who does not hold the permission appointment.book', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new BookAppointmentCommand(anActor().build(), 'calendar-a', wish('08:00'))),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Book appointment, within what the calendar allows', () => {
  it('refuses a calendar that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-unknown', wish('08:00'))),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CALENDAR' });
  });

  it.each([
    ['outside the opening hours', wish('12:00'), 'OUTSIDE_AVAILABILITY'],
    ['off the grid of its type', wish('08:10'), 'OFF_GRID'],
    [
      'sooner than the notice of the calendar',
      { ...wish('08:00'), startsAt: new Date('2026-03-01T08:30:00.000Z') },
      'BOOKING_TOO_LATE',
    ],
    [
      'further than the horizon of the calendar',
      { ...wish('08:00'), startsAt: new Date('2026-09-07T07:00:00.000Z') },
      'BOOKING_TOO_FAR',
    ],
  ])('refuses a slot %s', async (_rule, wished, code) => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', wished)),
    ).rejects.toMatchObject({ code });
  });

  it('refuses a slot that runs into the buffer of an active appointment, and saves and publishes nothing', async () => {
    const { application, appointmentRepository, announced, relationships } = await arrange(
      heldAt('08:00').lasting(30).withBuffer(10).build(),
    );

    await expect(
      application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', wish('08:30'))),
    ).rejects.toMatchObject({ code: 'SLOT_TAKEN' });

    expect(appointmentRepository.count()).toBe(1);
    expect(announced).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
    expect(relationships.current).toEqual([]);
  });

  it('books a slot that a cancelled appointment gave back', async () => {
    const { application } = await arrange(heldAt('08:00').cancelledByPatient().build());

    await expect(
      application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', wish('08:00'))),
    ).resolves.toBe('appointment-1');
  });

  it('refuses a patient who already holds as many future appointments with the practitioner as the calendar allows', async () => {
    const coming = ['13:00', '14:00', '15:00'].map((time) =>
      anAppointment().withPractitioner('practitioner-a').forPatient('patient-1').startingAt(at(time)).build(),
    );

    const { application } = await arrange(...coming);

    await expect(
      application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', wish('08:00'))),
    ).rejects.toMatchObject({ code: 'PATIENT_LIMIT_REACHED' });
  });
});

describe('Book appointment with an internal note', () => {
  it('keeps the note of whoever may write it', async () => {
    const { application, appointmentRepository } = await arrange();
    const noted = { ...wish('08:00'), internalNote: 'Hard of hearing on the left' };

    const id = await application.commandBus.execute(new BookAppointmentCommand(runner, 'calendar-a', noted));

    expect((await appointmentRepository.findById(id))?.internalNote).toBe('Hard of hearing on the left');
  });

  it('refuses the note of whoever may book but not write it, and books nothing', async () => {
    const { application, appointmentRepository } = await arrange();
    const noted = { ...wish('08:00'), internalNote: 'Written by the patient' };

    await expect(
      application.commandBus.execute(new BookAppointmentCommand(holder, 'calendar-a', noted)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(await appointmentRepository.findById('appointment-1')).toBeUndefined();
  });
});

async function arrange(...stored: readonly Appointment[]) {
  const appointmentRepository = new FakeAppointmentRepository();
  const calendarRepository = new FakeCalendarRepository();
  const relationships = new FakeSchedulingRelationships();
  const announced: string[] = [];

  await calendarRepository.save(openCalendar());

  await stored.reduce(
    (saved, appointment) => saved.then(() => appointmentRepository.save(appointment)),
    Promise.resolve(),
  );

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [
      fake(Agenda, new FakeAgenda()),
      fake(AppointmentRepository, appointmentRepository),
      fake(CalendarRepository, calendarRepository),
      fake(SchedulingRelationships, relationships),
    ],
    idPrefix: 'appointment',
    now: NOW,
  });

  application.domainEvents.on(
    'scheduling.appointment.booked',
    async () => void announced.push('scheduling.appointment.booked'),
  );

  return { application, appointmentRepository, relationships, announced };
}

function openCalendar() {
  return aCalendar()
    .identifiedBy('calendar-a')
    .ofPractitioner('practitioner-a', 'practice-a')
    .openEveryDay(['09:00', '12:00'], ['14:00', '18:00'])
    .offering('consultation', { buffer: 10 })
    .offering('first-visit', { needsConfirmation: true })
    .build();
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}

function wish(time: string, appointmentTypeId = 'consultation') {
  return { patientId: 'patient-1', appointmentTypeId, startsAt: at(time) };
}

function heldAt(time: string) {
  return anAppointment().onCalendar('calendar-a').withPractitioner('practitioner-a').startingAt(at(time));
}
