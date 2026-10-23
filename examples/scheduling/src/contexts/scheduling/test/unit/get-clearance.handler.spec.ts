import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { ClearCalendarCommand } from '@/contexts/scheduling/application/calendars/commands/clear-calendar/clear-calendar.command';
import { GetClearanceQuery } from '@/contexts/scheduling/application/calendars/queries/get-clearance/get-clearance.query';
import { ConfirmationDeadlineTimeoutBackgroundJob } from '@/contexts/scheduling/application/calendars/background/confirmation-deadline-timeout.background-job';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: {
      holder: [schedulingPermissions['calendar.clear'], schedulingPermissions['appointment.cancel']],
      system: [schedulingPermissions['waitlist.offer'], schedulingPermissions['attendance.note']],
    },
    systemRole: 'system',
  }),
});

const holder = anActor().withRole('holder').build();

describe('Get clearance', () => {
  it('answers how far the clearance went: waiting first, then done with every appointment', async () => {
    const { application, clearance } = await arrange();
    const asked = new GetClearanceQuery(holder, 'calendar-1', clearance);

    expect(await application.queryBus.execute(asked)).toEqual({
      clearanceId: clearance,
      status: 'waiting',
      attempts: 0,
      done: 0,
    });

    await application.backgroundJobs.runDue();

    expect(await application.queryBus.execute(asked)).toEqual({
      clearanceId: clearance,
      status: 'succeeded',
      attempts: 1,
      done: 1,
      total: 1,
    });
  });

  it('refuses an identifier that names no clearance, or another job', async () => {
    const { application } = await arrange();

    const other = await application.jobQueue.enqueue(ConfirmationDeadlineTimeoutBackgroundJob, {
      id: 'a',
      timeout: 'b',
    });

    for (const clearanceId of ['clearance-9', other.id]) {
      await expect(
        application.queryBus.execute(new GetClearanceQuery(holder, 'calendar-1', clearanceId)),
      ).rejects.toMatchObject({ code: 'UNKNOWN_CLEARANCE' });
    }
  });

  it('refuses the clearance of another calendar, whoever knows its identifier', async () => {
    const { application, clearance } = await arrange();

    await expect(
      application.queryBus.execute(new GetClearanceQuery(holder, 'calendar-2', clearance)),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CLEARANCE' });
  });

  it('is refused to an actor who does not hold the permission calendar.clear', async () => {
    const { application, clearance } = await arrange();

    await expect(
      application.queryBus.execute(new GetClearanceQuery(anActor().build(), 'calendar-1', clearance)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

async function arrange() {
  const { application } = await aSchedulingWorld({
    modules: [holders],
    given: async (fakes) => {
      await fakes.calendarRepository.save(aCalendar().identifiedBy('calendar-1').build());

      await fakes.appointmentRepository.save(
        anAppointment().onCalendar('calendar-1').startingAt(new Date('2026-08-04T08:00:00.000Z')).build(),
      );
    },
  });

  const clearance = await application.as(holder, (actor) =>
    application.commandBus.execute(
      new ClearCalendarCommand(
        actor,
        'calendar-1',
        new Date('2026-08-03T00:00:00.000Z'),
        new Date('2026-08-17T00:00:00.000Z'),
        'The practitioner is away',
      ),
    ),
  );

  return { application, clearance };
}
