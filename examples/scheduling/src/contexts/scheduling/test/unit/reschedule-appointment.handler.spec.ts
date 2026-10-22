import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { RescheduleAppointmentCommand } from '@/contexts/scheduling/application/calendars/commands/reschedule-appointment/reschedule-appointment.command';
import type { Appointment } from '@/contexts/scheduling/domain/calendars/aggregates/appointment.aggregate';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: {
      holder: [schedulingPermissions['appointment.reschedule']],
      system: [schedulingPermissions['waitlist.offer']],
    },
    systemRole: 'system',
  }),
});

const holder = anActor().withRole('holder').build();
const patient = anActor().named('patient-1').withRole('holder').build();
// Tuesday 3 March 2026 in Europe/Paris is UTC+1: 09:00 on the wall clock is 08:00Z.
const NOW = new Date('2026-03-02T08:00:00.000Z');

describe('Reschedule appointment', () => {
  it('moves the appointment to the free slot in one step and answers its identifier', async () => {
    const appointment = heldAt('08:00').build();
    const { application, appointmentRepository } = await arrange(appointment);

    const id = await application.commandBus.execute(
      new RescheduleAppointmentCommand(holder, appointment.id, at('14:00')),
    );

    const stored = await appointmentRepository.findById(id);

    expect(id).toBe(appointment.id);
    expect(stored?.slot.startsAt).toEqual(at('14:00'));
    expect(stored?.slot.heldUntil).toEqual(at('14:40'));
    expect(await appointmentRepository.heldOn('calendar-a', at('08:00'), at('08:30'))).toEqual([]);
  });

  it('announces the new slot and the one that was left', async () => {
    const appointment = heldAt('08:00').build();
    const { application, announced } = await arrange(appointment);

    await application.commandBus.execute(new RescheduleAppointmentCommand(holder, appointment.id, at('14:00')));

    expect(announced).toEqual(['scheduling.appointment.rescheduled']);

    expect(application.eventBus.published).toMatchObject([
      {
        type: 'scheduling.appointment.rescheduled',
        payload: {
          appointmentId: appointment.id,
          startsAt: '2026-03-03T14:00:00.000Z',
          previousStartsAt: '2026-03-03T08:00:00.000Z',
          previousDay: '2026-03-03',
        },
      },
    ]);
  });

  it('lets the patient move their appointment until 24 hours before its start', async () => {
    const appointment = heldAt('08:00').build();
    const { application } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(patient, appointment.id, at('14:00'))),
    ).resolves.toBe(appointment.id);
  });

  it('refuses the patient who moves their appointment less than 24 hours before its start, naming the rule', async () => {
    const appointment = heldAt('07:30').lasting(30).build();
    const { application, appointmentRepository, announced } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(patient, appointment.id, at('14:00'))),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', reason: 'scheduling.patient-reschedules-until-notice' });

    expect((await appointmentRepository.findById(appointment.id))?.slot.startsAt).toEqual(at('07:30'));
    expect(announced).toEqual([]);
  });

  it('lets the practice move an appointment less than 24 hours before its start', async () => {
    const appointment = heldAt('07:30').build();
    const { application } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(holder, appointment.id, at('14:00'))),
    ).resolves.toBe(appointment.id);
  });

  it('is refused to an actor who does not hold the permission appointment.reschedule', async () => {
    const appointment = heldAt('08:00').build();
    const { application } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(anActor().build(), appointment.id, at('14:00'))),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses an appointment that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(holder, 'appointment-unknown', at('14:00'))),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('refuses a slot another appointment holds, and saves and publishes nothing', async () => {
    const appointment = heldAt('08:00').build();
    const other = heldAt('14:00').forPatient('patient-2').build();
    const { application, appointmentRepository, announced } = await arrange(appointment, other);

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(holder, appointment.id, at('14:00'))),
    ).rejects.toMatchObject({ code: 'SLOT_TAKEN' });

    expect((await appointmentRepository.findById(appointment.id))?.slot.startsAt).toEqual(at('08:00'));
    expect(announced).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });

  it('lets the appointment move onto a part of the time it holds itself', async () => {
    const appointment = heldAt('08:00').lasting(60).build();
    const { application, appointmentRepository } = await arrange(appointment);

    await application.commandBus.execute(new RescheduleAppointmentCommand(holder, appointment.id, at('08:30')));

    expect((await appointmentRepository.findById(appointment.id))?.slot.startsAt).toEqual(at('08:30'));
  });

  it.each([
    ['outside the opening hours', at('12:00'), 'OUTSIDE_AVAILABILITY'],
    ['off the grid of its type', at('14:10'), 'OFF_GRID'],
  ])('refuses a slot %s', async (_rule, startsAt, code) => {
    const appointment = heldAt('08:00').build();
    const { application } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(holder, appointment.id, startsAt)),
    ).rejects.toMatchObject({ code });
  });

  it('refuses an appointment that has already ended', async () => {
    const cancelled = heldAt('08:00').cancelledByPatient().build();
    const { application } = await arrange(cancelled);

    await expect(
      application.commandBus.execute(new RescheduleAppointmentCommand(holder, cancelled.id, at('14:00'))),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_ENDED' });
  });
});

async function arrange(...stored: readonly Appointment[]) {
  const announced: string[] = [];

  const calendar = aCalendar()
    .identifiedBy('calendar-a')
    .ofPractitioner('practitioner-a', 'practice-a')
    .openEveryDay(['08:30', '12:00'], ['14:00', '18:00'])
    .offering('consultation', { buffer: 10 })
    .build();

  const { application, appointmentRepository } = await aSchedulingWorld({
    modules: [holders],
    now: NOW,
    given: async (fakes) => {
      await fakes.calendarRepository.save(calendar);

      await stored.reduce(
        (saved, appointment) => saved.then(() => fakes.appointmentRepository.save(appointment)),
        Promise.resolve(),
      );
    },
  });

  application.domainEvents.on(
    'scheduling.appointment.rescheduled',
    async () => void announced.push('scheduling.appointment.rescheduled'),
  );

  return { application, appointmentRepository, announced };
}

function at(time: string): Date {
  return new Date(`2026-03-03T${time}:00.000Z`);
}

function heldAt(time: string) {
  return anAppointment()
    .onCalendar('calendar-a')
    .inPractice('practice-a')
    .withPractitioner('practitioner-a')
    .forPatient('patient-1')
    .startingAt(at(time));
}
