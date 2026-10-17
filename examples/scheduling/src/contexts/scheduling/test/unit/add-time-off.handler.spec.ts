import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { AddTimeOffCommand } from '@/contexts/scheduling/application/commands/add-time-off/add-time-off.command';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { anAppointment, type AppointmentBuilder } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['calendar.add-time-off']] } }),
});

const holder = anActor().withRole('holder').build();
const now = new Date('2026-07-01T08:00:00.000Z');
const startsAt = new Date('2026-08-03T00:00:00.000Z');
const endsAt = new Date('2026-08-17T00:00:00.000Z');

describe('Add time off', () => {
  it('closes the calendar over the period and answers its identifier', async () => {
    const { application, calendarRepository } = await arrange();

    const id = await application.commandBus.execute(new AddTimeOffCommand(holder, 'calendar-1', startsAt, endsAt));

    const stored = await calendarRepository.findById('calendar-1');

    expect(id).toBe('calendar-1');

    expect(() => stored?.slotFor('consultation', new Date('2026-08-03T08:00:00.000Z'), now)).toThrow(
      expect.objectContaining({ code: 'OUTSIDE_AVAILABILITY' }),
    );

    expect(stored?.slotFor('consultation', new Date('2026-08-17T08:00:00.000Z'), now)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission calendar.add-time-off', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new AddTimeOffCommand(anActor().build(), 'calendar-1', startsAt, endsAt)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('announces the time off with its period', async () => {
    const { application } = await arrange();
    const announced: unknown[] = [];

    application.domainEvents.on('scheduling.calendar.time-off-added', async (event) => {
      announced.push(event);
    });

    await application.commandBus.execute(new AddTimeOffCommand(holder, 'calendar-1', startsAt, endsAt));

    expect(announced).toMatchObject([{ aggregateId: 'calendar-1', startsAt, endsAt }]);
  });

  it('refuses a time off that covers an active appointment of the calendar, and leaves the calendar as it was', async () => {
    const { application, calendarRepository } = await arrange(
      anAppointment().onCalendar('calendar-1').startingAt(new Date('2026-08-04T08:00:00.000Z')),
    );

    await expect(
      application.commandBus.execute(new AddTimeOffCommand(holder, 'calendar-1', startsAt, endsAt)),
    ).rejects.toMatchObject({ code: 'TIME_OFF_OVER_APPOINTMENTS' });

    expect((await calendarRepository.findById('calendar-1'))?.timeOffs).toEqual([]);
  });

  it('accepts a time off over an appointment that was cancelled, and over the appointments of another calendar', async () => {
    const { application, calendarRepository } = await arrange(
      anAppointment().onCalendar('calendar-1').startingAt(new Date('2026-08-04T08:00:00.000Z')).cancelledByPatient(),
      anAppointment().onCalendar('calendar-2').startingAt(new Date('2026-08-04T08:00:00.000Z')),
    );

    await application.commandBus.execute(new AddTimeOffCommand(holder, 'calendar-1', startsAt, endsAt));

    expect((await calendarRepository.findById('calendar-1'))?.timeOffs).toHaveLength(1);
  });

  it('refuses a period that ends before it starts', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new AddTimeOffCommand(holder, 'calendar-1', endsAt, startsAt)),
    ).rejects.toMatchObject({ code: 'INVALID_TIME_OFF' });
  });

  it('refuses a calendar that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new AddTimeOffCommand(holder, 'calendar-9', startsAt, endsAt)),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CALENDAR' });
  });
});

/** The appointments are stored before the application exists: what they announced is not the matter of these tests. */
async function arrange(...appointments: readonly AppointmentBuilder[]) {
  const { application, calendarRepository } = await aSchedulingWorld({
    modules: [holders],
    idPrefix: 'id',
    given: async (fakes) => {
      await Promise.all(appointments.map((appointment) => fakes.appointmentRepository.save(appointment.build())));

      await fakes.calendarRepository.save(
        aCalendar().identifiedBy('calendar-1').openEveryDay(['08:00', '20:00']).offering('consultation').build(),
      );
    },
  });

  return { application, calendarRepository };
}
