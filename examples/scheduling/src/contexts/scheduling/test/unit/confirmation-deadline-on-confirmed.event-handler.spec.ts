import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication } from '@ddd-ts-kit/di';
import { ProcessRunner } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { ConfirmationDeadlineOnBookedEventHandler } from '@/contexts/scheduling/application/event-handlers/confirmation-deadline-on-booked.event-handler';
import { ConfirmationDeadlineOnConfirmedEventHandler } from '@/contexts/scheduling/application/event-handlers/confirmation-deadline-on-confirmed.event-handler';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
import { AppointmentConfirmed } from '@/contexts/scheduling/domain/events/appointment-confirmed.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const deadline = new Date('2026-03-01T12:00:00.000Z');
const booking = anAppointment().build().booking;

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { scheduler: [schedulingPermissions['appointment.expire']] },
    systemRole: 'scheduler',
  }),
});

describe('When an appointment is confirmed, its confirmation deadline', () => {
  it('is disarmed: the process ends and its delayed job is cancelled', async () => {
    const application = arrange();

    await booked(application).handle(
      new AppointmentBooked('appointment-1', deadline, { booking, confirmBefore: deadline }),
    );

    await settled(application).handle(new AppointmentConfirmed('appointment-1', deadline, booking));

    expect(application.processes.list()).toMatchObject([
      { id: 'appointment-1', version: 2, ended: true, timeouts: {} },
    ]);

    expect(application.backgroundJobs.store.list()).toMatchObject([{ status: 'cancelled' }]);
  });

  it('changes nothing for an appointment no deadline watches', async () => {
    const application = arrange();

    await settled(application).handle(new AppointmentConfirmed('appointment-1', deadline, booking));

    expect(application.processes.list()).toEqual([]);
  });
});

function arrange() {
  return createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), authorization],
  });
}

function booked(application: ReturnType<typeof arrange>): ConfirmationDeadlineOnBookedEventHandler {
  return new ConfirmationDeadlineOnBookedEventHandler(application.get(ProcessRunner));
}

function settled(application: ReturnType<typeof arrange>): ConfirmationDeadlineOnConfirmedEventHandler {
  return new ConfirmationDeadlineOnConfirmedEventHandler(application.get(ProcessRunner));
}
