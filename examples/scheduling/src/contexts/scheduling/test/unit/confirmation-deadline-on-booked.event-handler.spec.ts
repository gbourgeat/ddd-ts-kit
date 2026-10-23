import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication } from '@ddd-ts-kit/di';
import { ProcessRunner } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { ConfirmationDeadlineOnBookedEventHandler } from '@/contexts/scheduling/application/calendars/event-handlers/confirmation-deadline-on-booked.event-handler';
import { AppointmentBooked } from '@/contexts/scheduling/domain/calendars/events/appointment-booked.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const deadline = new Date('2026-03-01T12:00:00.000Z');
const booking = anAppointment().build().booking;

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { scheduler: [schedulingPermissions['appointment.expire']] },
    systemRole: 'scheduler',
  }),
});

describe('When an appointment is booked, its confirmation deadline', () => {
  it('is armed for a requested appointment: a delayed job waits for the deadline', async () => {
    const application = arrange();

    await booked(application).handle(
      new AppointmentBooked('appointment-1', deadline, { booking, confirmBefore: deadline }),
    );

    expect(application.processes.list()).toMatchObject([
      { name: 'scheduling.confirmation-deadline', id: 'appointment-1', version: 1, ended: false },
    ]);

    expect(application.backgroundJobs.store.list()).toMatchObject([
      { name: 'scheduling.confirmation-deadline-timeout', status: 'waiting', runAt: deadline },
    ]);
  });

  it('is not armed for an appointment booked outright', async () => {
    const application = arrange();

    await booked(application).handle(new AppointmentBooked('appointment-1', deadline, { booking }));

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
