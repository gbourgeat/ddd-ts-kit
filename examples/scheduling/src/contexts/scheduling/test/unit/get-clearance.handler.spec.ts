import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { ClearCalendarCommand } from '@/contexts/scheduling/application/commands/clear-calendar/clear-calendar.command';
import { GetClearanceQuery } from '@/contexts/scheduling/application/queries/get-clearance/get-clearance.query';
import { ConfirmationDeadlineTimeoutBackgroundJob } from '@/contexts/scheduling/application/background/confirmation-deadline-timeout.background-job';
import { Agenda } from '@/contexts/scheduling/application/ports/agenda.port';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { WaitlistRepository } from '@/contexts/scheduling/domain/repositories/waitlist.repository';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';
import { FakeWaitlistRepository } from '@/contexts/scheduling/test/fakes/waitlist.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: {
      holder: [schedulingPermissions['calendar.clear'], schedulingPermissions['appointment.cancel']],
      system: [schedulingPermissions['waitlist.offer']],
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

  it('is refused to an actor who does not hold the permission calendar.clear', async () => {
    const { application, clearance } = await arrange();

    await expect(
      application.queryBus.execute(new GetClearanceQuery(anActor().build(), 'calendar-1', clearance)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

async function arrange() {
  const calendars = new FakeCalendarRepository();
  const appointments = new FakeAppointmentRepository();

  await calendars.save(aCalendar().identifiedBy('calendar-1').build());

  await appointments.save(
    anAppointment().onCalendar('calendar-1').startingAt(new Date('2026-08-04T08:00:00.000Z')).build(),
  );

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [
      fake(Agenda, new FakeAgenda()),
      fake(CalendarRepository, calendars),
      fake(AppointmentRepository, appointments),
      fake(WaitlistRepository, new FakeWaitlistRepository()),
    ],
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
