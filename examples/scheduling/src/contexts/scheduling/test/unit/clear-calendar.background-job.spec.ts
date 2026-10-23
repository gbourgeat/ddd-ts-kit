import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/calendars/commands/cancel-appointment/cancel-appointment.command';
import { ClearCalendarCommand } from '@/contexts/scheduling/application/calendars/commands/clear-calendar/clear-calendar.command';
import { Agenda } from '@/contexts/scheduling/application/calendars/ports/agenda.port';
import { AppointmentRepository } from '@/contexts/scheduling/domain/calendars/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { WaitlistRepository } from '@/contexts/scheduling/domain/waitlist/repositories/waitlist.repository';
import { AppointmentStatus } from '@/contexts/scheduling/domain/calendars/vocabularies/appointment-status.vocabulary';
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

    for (const id of IDS) {
      const appointment = await appointments.findById(id);

      expect(appointment?.status).toBe(AppointmentStatus.Cancelled);
      expect(appointment?.cancellation).toMatchObject({ by: 'practice', reason: REASON });
    }

    expect((await appointments.findById('after'))?.status).toBe(AppointmentStatus.Booked);
    expect(application.backgroundJobs.store.list()).toMatchObject([{ progress: { done: 3, total: 3 } }]);
  });

  it('resumes after the last appointment an interrupted attempt handled, never cancelling one twice', async () => {
    const { application } = await cleared();
    const sent: string[] = [];
    let failures = 1;

    application.commandBus.use(async (message, next) => {
      if (message instanceof CancelAppointmentCommand) {
        sent.push(message.appointmentId);

        if (message.appointmentId === 'second' && failures-- > 0) {
          throw new Error('the database went away');
        }
      }

      return next();
    });

    await expect(application.backgroundJobs.runDue()).rejects.toThrow('the database went away');
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
});

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

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [
      fake(Agenda, new FakeAgenda()),
      fake(CalendarRepository, calendars),
      fake(AppointmentRepository, appointments),
      fake(WaitlistRepository, new FakeWaitlistRepository()),
    ],
  });

  await application.as(holder, (actor) =>
    application.commandBus.execute(new ClearCalendarCommand(actor, 'calendar-1', startsAt(3), startsAt(17), REASON)),
  );

  return { application, appointments };
}
