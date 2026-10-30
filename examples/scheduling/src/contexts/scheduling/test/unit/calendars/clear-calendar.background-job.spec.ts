import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import type { BackgroundJobType, BusMiddleware } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { CancelAppointmentCommand } from '@/contexts/scheduling/calendars/application/commands/cancel-appointment/cancel-appointment.command';
import { ClearCalendarCommand } from '@/contexts/scheduling/calendars/application/commands/clear-calendar/clear-calendar.command';
import { Agenda } from '@/contexts/scheduling/calendars/application/ports/agenda.port';
import { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/calendars/domain/repositories/calendar.repository';
import { WaitlistRepository } from '@/contexts/scheduling/waitlist/domain/repositories/waitlist.repository';
import { ClearCalendarBackgroundJob } from '@/contexts/scheduling/calendars/application/background/clear-calendar.background-job';
import { AppointmentStatus } from '@/contexts/scheduling/calendars/domain/vocabularies/appointment-status.vocabulary';
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
      system: [schedulingPermissions['waitlist.offer'], schedulingPermissions['attendance.note']],
    },
    systemRole: 'system',
  }),
});

const holder = anActor().withRole('holder').build();
const REASON = 'The practitioner is away';
const BACKOFF_MS = 1_000;
const IDS = ['first', 'second', 'third'];

describe('The clearance of a calendar, when its job runs', () => {
  it('cancels each appointment of the period for the practice, as the person who asked, and says how far it went', async () => {
    const { application, appointments } = await cleared();

    expect(await application.backgroundJobs.runDue()).toMatchObject([
      { job: 'scheduling.clear-calendar', outcome: 'succeeded' },
    ]);

    expect(await Promise.all(IDS.map((id) => appointments.findById(id)))).toMatchObject(
      IDS.map(() => ({ status: AppointmentStatus.Cancelled, cancellation: { by: 'practice', reason: REASON } })),
    );

    expect((await appointments.findById('after'))?.status).toBe(AppointmentStatus.Booked);
    expect(application.backgroundJobs.store.list()).toMatchObject([{ progress: { done: 3, total: 3 } }]);
  });

  it('resumes after the last appointment an interrupted attempt handled, never cancelling one twice', async () => {
    const { application } = await cleared();
    const sent: string[] = [];
    const outage = new Error('the database went away');

    application.commandBus.use(cancellationsNoted(sent, outage));

    await expect(application.backgroundJobs.runDue()).rejects.toBe(outage);
    expect(application.backgroundJobs.store.list()).toMatchObject([{ status: 'waiting', progress: { done: 1 } }]);

    application.clock.advance(BACKOFF_MS);
    await application.backgroundJobs.runDue();

    expect(sent).toEqual(['first', 'second', 'second', 'third']);
    expect(application.backgroundJobs.store.list()).toMatchObject([{ status: 'succeeded', attempts: 2 }]);
  });

  it('takes an appointment cancelled meanwhile by its patient as done', async () => {
    const { application, appointments } = await cleared();

    const patient = anActor().named('patient-1').withRole('holder').build();

    await application.commandBus.execute(new CancelAppointmentCommand(patient, 'second'));

    expect(await application.backgroundJobs.runDue()).toMatchObject([{ outcome: 'succeeded' }]);
    expect((await appointments.findById('second'))?.cancellation).toMatchObject({ by: 'patient' });
  });

  it('never runs a clearance enqueued in an earlier shape, without the reason its patients read: the job is dead', async () => {
    const appointments = new FakeAppointmentRepository();
    const application = applicationOn(new FakeCalendarRepository(), appointments);
    const earlierVersion: BackgroundJobType<unknown> = ClearCalendarBackgroundJob;

    await appointments.save(anAppointment().identifiedBy('first').onCalendar('calendar-1').build());

    await application.as(holder, () =>
      application.jobQueue.enqueue(earlierVersion, { calendarId: 'calendar-1', appointmentIds: ['first'] }),
    );

    await expect(application.backgroundJobs.runDue()).rejects.toMatchObject({
      code: 'INVALID_JOB_PAYLOAD',
      issues: [{ path: 'reason' }],
    });

    expect((await appointments.findById('first'))?.status).toBe(AppointmentStatus.Booked);

    expect(application.backgroundJobs.store.list()).toMatchObject([
      { status: 'dead', lastErrorCode: 'INVALID_JOB_PAYLOAD' },
    ]);
  });
});

/** The bus as a flaky database leaves it: every cancellation noted in `sent`, the first one of `second` refused with `outage`. */
function cancellationsNoted(sent: string[], outage: Error): BusMiddleware {
  let failures = 1;

  return async (message, next) => {
    if (message instanceof CancelAppointmentCommand) {
      sent.push(message.appointmentId);

      if (message.appointmentId === 'second' && failures-- > 0) {
        throw outage;
      }
    }

    return next();
  };
}

/** Three appointments inside the period, one after it, and the clearance of the period asked, as the holder of the calendar. */
async function cleared() {
  const calendars = new FakeCalendarRepository();
  const appointments = new FakeAppointmentRepository();
  const startsAt = (day: number): Date => new Date(Date.UTC(2026, 7, day, 8));

  await calendars.save(aCalendar().identifiedBy('calendar-1').build());

  await Promise.all(
    [...IDS, 'after'].map((id, index) =>
      appointments.save(
        anAppointment()
          .identifiedBy(id)
          .onCalendar('calendar-1')
          .startingAt(startsAt(4 + index * 5))
          .build(),
      ),
    ),
  );

  const application = applicationOn(calendars, appointments);

  await application.as(holder, (actor) =>
    application.commandBus.execute(new ClearCalendarCommand(actor, 'calendar-1', startsAt(3), startsAt(17), REASON)),
  );

  return { application, appointments };
}

/** The test application of the context on the repositories given, its other ports faked. */
function applicationOn(calendars: FakeCalendarRepository, appointments: FakeAppointmentRepository) {
  return createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [
      fake(Agenda, new FakeAgenda()),
      fake(CalendarRepository, calendars),
      fake(AppointmentRepository, appointments),
      fake(WaitlistRepository, new FakeWaitlistRepository()),
    ],
  });
}
