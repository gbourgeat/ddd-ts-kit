import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { ClearCalendarCommand } from '@/contexts/scheduling/application/calendars/commands/clear-calendar/clear-calendar.command';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { anAppointment, type AppointmentBuilder } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['calendar.clear']] } }),
});

const holder = anActor().withRole('holder').build();
const startsAt = new Date('2026-08-03T00:00:00.000Z');
const endsAt = new Date('2026-08-17T00:00:00.000Z');
const REASON = 'The practitioner is away';

describe('Clear calendar', () => {
  it('hands the clearance to a worker and answers its identifier', async () => {
    const { application } = await arrange(
      anAppointment().identifiedBy('inside').onCalendar('calendar-1').startingAt(new Date('2026-08-04T08:00:00.000Z')),
    );

    const clearance = await application.commandBus.execute(
      new ClearCalendarCommand(holder, 'calendar-1', startsAt, endsAt, REASON),
    );

    expect(application.backgroundJobs.store.list()).toMatchObject([
      { id: clearance, name: 'scheduling.clear-calendar', status: 'waiting', attempts: 0 },
    ]);
  });

  it('is refused to an actor who does not hold the permission calendar.clear', async () => {
    const { application } = await arrange();
    const command = new ClearCalendarCommand(anActor().build(), 'calendar-1', startsAt, endsAt, REASON);

    await expect(application.commandBus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses a calendar that does not exist, and a period that ends before it starts, and enqueues nothing', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new ClearCalendarCommand(holder, 'calendar-9', startsAt, endsAt, REASON)),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CALENDAR' });

    await expect(
      application.commandBus.execute(new ClearCalendarCommand(holder, 'calendar-1', endsAt, startsAt, REASON)),
    ).rejects.toMatchObject({ code: 'INVALID_TIME_OFF' });

    expect(application.backgroundJobs.store.list()).toEqual([]);
  });
});

async function arrange(...appointments: readonly AppointmentBuilder[]) {
  const { application } = await aSchedulingWorld({
    modules: [holders],
    given: async (fakes) => {
      await Promise.all(appointments.map((appointment) => fakes.appointmentRepository.save(appointment.build())));
      await fakes.calendarRepository.save(aCalendar().identifiedBy('calendar-1').build());
    },
  });

  return { application };
}
