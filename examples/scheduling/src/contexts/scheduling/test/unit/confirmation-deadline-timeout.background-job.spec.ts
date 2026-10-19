import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication } from '@ddd-ts-kit/di';
import { ProcessRunner, type Message } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { ExpireUnconfirmedAppointmentsCommand } from '@/contexts/scheduling/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command';
import { ConfirmationDeadlineOnBookedEventHandler } from '@/contexts/scheduling/application/event-handlers/confirmation-deadline-on-booked.event-handler';
import { ConfirmationDeadlineOnConfirmedEventHandler } from '@/contexts/scheduling/application/event-handlers/confirmation-deadline-on-confirmed.event-handler';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
import { AppointmentConfirmed } from '@/contexts/scheduling/domain/events/appointment-confirmed.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const booking = anAppointment().build().booking;

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { scheduler: [schedulingPermissions['appointment.expire']] },
    systemRole: 'scheduler',
  }),
});

describe('The timeout of a confirmation deadline, when its job runs', () => {
  it('expires the requested appointments at the deadline, as the process', async () => {
    const { application, sent, deadline } = await armed();

    expect(await application.backgroundJobs.runDue()).toEqual([]);

    application.clock.advance(deadline.getTime() - application.clock.now().getTime());

    expect(await application.backgroundJobs.runDue()).toMatchObject([
      { job: 'scheduling.confirmation-deadline-timeout', outcome: 'succeeded' },
    ]);

    expect(sent).toMatchObject([{ at: deadline, actor: { id: 'system:scheduling.confirmation-deadline' } }]);
    expect(sent[0]).toBeInstanceOf(ExpireUnconfirmedAppointmentsCommand);
    expect(application.processes.list()).toMatchObject([{ ended: true }]);
  });

  it('sends nothing once the appointment was confirmed', async () => {
    const { application, sent, deadline } = await armed();

    await new ConfirmationDeadlineOnConfirmedEventHandler(application.get(ProcessRunner)).handle(
      new AppointmentConfirmed('appointment-1', deadline, booking),
    );

    application.clock.advance(deadline.getTime() - application.clock.now().getTime());
    await application.backgroundJobs.runDue();

    expect(sent).toEqual([]);
  });
});

/** A requested appointment whose deadline is one hour after the clock of the test application. */
async function armed() {
  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), authorization],
  });

  const deadline = new Date(application.clock.now().getTime() + 3_600_000);
  const sent: Message[] = [];

  application.commandBus.use(async (message) => {
    sent.push(message);
  });

  await new ConfirmationDeadlineOnBookedEventHandler(application.get(ProcessRunner)).handle(
    new AppointmentBooked('appointment-1', deadline, { booking, confirmBefore: deadline }),
  );

  return { application, sent, deadline };
}
