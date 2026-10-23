import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import type { Message } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { ExpireUnconfirmedAppointmentsCommand } from '@/contexts/scheduling/calendars/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command';
import { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/calendars/domain/repositories/calendar.repository';
import { WaitlistRepository } from '@/contexts/scheduling/waitlist/domain/repositories/waitlist.repository';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';
import { FakeWaitlistRepository } from '@/contexts/scheduling/test/fakes/waitlist.repository.fake';
import { Agenda } from '@/contexts/scheduling/calendars/application/ports/agenda.port';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { scheduler: [schedulingPermissions['appointment.expire'], schedulingPermissions['waitlist.offer']] },
    systemRole: 'scheduler',
  }),
});

// A freed slot is offered to the waitlist of its calendar: every calendar exists here, and nobody waits.
const calendars = { findById: async (id: string) => aCalendar().identifiedBy(id).build(), save: async () => undefined };

describe('Expire unconfirmed appointments, when its time comes', () => {
  it('sends expire unconfirmed appointments as the system actor of the job', async () => {
    const { application, sent } = arrange();

    await application.jobs.runNow('scheduling.expire-unconfirmed-appointments');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(ExpireUnconfirmedAppointmentsCommand);

    expect(sent[0]).toMatchObject({
      actor: { id: 'system:scheduling.expire-unconfirmed-appointments', type: 'system' },
    });
  });

  it('names the instant the occurrence was planned for, never the one it really runs', async () => {
    const { application, sent } = arrange();

    const run = await application.jobs.runNow('scheduling.expire-unconfirmed-appointments');

    expect(sent[0]).toMatchObject({ at: run.scheduledAt });
  });

  it('has the same outcome when the same occurrence runs twice', async () => {
    const appointmentRepository = new FakeAppointmentRepository();

    const application = createTestApplication({
      modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), authorization],
      tenants: ['north'],
      fakes: [
        fake(Agenda, new FakeAgenda()),
        fake(AppointmentRepository, appointmentRepository),
        fake(CalendarRepository, calendars),
        fake(WaitlistRepository, new FakeWaitlistRepository()),
      ],
    });

    const due = anAppointment()
      .bornAt(new Date('2020-01-01T00:00:00.000Z'))
      .requestedUntil(new Date('2020-01-02T00:00:00.000Z'))
      .build();

    await appointmentRepository.save(due);
    await application.jobs.runNow('scheduling.expire-unconfirmed-appointments');
    const announced = application.eventBus.published.map((event) => event.type);

    await application.jobs.runNow('scheduling.expire-unconfirmed-appointments');

    expect((await appointmentRepository.findById(due.id))?.status).toBe('expired');
    expect(announced).toContain('scheduling.appointment.expired');
    expect(application.eventBus.published).toHaveLength(announced.length);
  });
});

function arrange() {
  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), authorization],
    tenants: ['north'],
  });

  const sent: Message[] = [];

  application.commandBus.use(async (message) => {
    sent.push(message);
  });

  return { application, sent };
}
