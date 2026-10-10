import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '#src/contexts/scheduling/scheduling.declarations.js';
import { platformTestModule } from '#src/platform/platform-test.module.js';
import { schedulingPermissions } from '#src/contexts/scheduling/application/authorization/scheduling.permissions.js';
import { ExpireUnconfirmedAppointmentsCommand } from '#src/contexts/scheduling/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command.js';
import { AppointmentRepository } from '#src/contexts/scheduling/domain/repositories/appointment.repository.js';
import { CalendarRepository } from '#src/contexts/scheduling/domain/repositories/calendar.repository.js';
import { WaitlistRepository } from '#src/contexts/scheduling/domain/repositories/waitlist.repository.js';
import type { Appointment } from '#src/contexts/scheduling/domain/aggregates/appointment.aggregate.js';
import { anAppointment } from '#src/contexts/scheduling/test/builders/appointment.builder.js';
import { aCalendar } from '#src/contexts/scheduling/test/builders/calendar.builder.js';
import { FakeAppointmentRepository } from '#src/contexts/scheduling/test/fakes/appointment.repository.fake.js';
import { FakeWaitlistRepository } from '#src/contexts/scheduling/test/fakes/waitlist.repository.fake.js';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [schedulingPermissions['appointment.expire']], system: [schedulingPermissions['waitlist.offer']] },
    systemRole: 'system',
  }),
});

const holder = anActor().withRole('holder').build();
// A freed slot is offered to the waitlist of its calendar: every calendar exists here, and nobody waits.
const calendars = { findById: async (id: string) => aCalendar().identifiedBy(id).build(), save: async () => undefined };
const NOW = new Date('2026-03-01T09:07:00.000Z');
const AT = new Date('2026-03-01T09:00:00.000Z');
const FACTS = ['scheduling.appointment.expired'] as const;

describe('Expire unconfirmed appointments', () => {
  it('expires every requested appointment whose deadline is reached at the instant of the occurrence', async () => {
    const due = anAppointment().requestedUntil(new Date('2026-03-01T08:30:00.000Z')).build();
    const dueNow = anAppointment().requestedUntil(AT).build();
    const { application, appointmentRepository, announced } = await arrange(due, dueNow);

    await application.commandBus.execute(new ExpireUnconfirmedAppointmentsCommand(holder, AT));

    expect((await appointmentRepository.findById(due.id))?.status).toBe('expired');
    expect((await appointmentRepository.findById(dueNow.id))?.status).toBe('expired');
    expect(announced).toEqual(['scheduling.appointment.expired', 'scheduling.appointment.expired']);
  });

  it('dates the expiry at the instant of the occurrence, not at the one it really runs', async () => {
    const due = anAppointment().requestedUntil(new Date('2026-03-01T08:30:00.000Z')).build();
    const { application, appointmentRepository } = await arrange(due);

    await application.commandBus.execute(new ExpireUnconfirmedAppointmentsCommand(holder, AT));

    expect((await appointmentRepository.findById(due.id))?.changedAt).toEqual(AT);

    expect(application.eventBus.published).toMatchObject([
      { type: 'scheduling.appointment.expired', occurredAt: AT.toISOString(), payload: { appointmentId: due.id } },
    ]);
  });

  it('leaves the appointments whose deadline is later, and those that are booked', async () => {
    const later = anAppointment().requestedUntil(new Date('2026-03-01T09:05:00.000Z')).build();
    const booked = anAppointment().build();
    const { application, appointmentRepository, announced } = await arrange(later, booked);

    await application.commandBus.execute(new ExpireUnconfirmedAppointmentsCommand(holder, AT));

    expect((await appointmentRepository.findById(later.id))?.status).toBe('requested');
    expect((await appointmentRepository.findById(booked.id))?.status).toBe('booked');
    expect(announced).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });

  it('changes nothing when the same occurrence runs twice', async () => {
    const due = anAppointment().requestedUntil(new Date('2026-03-01T08:30:00.000Z')).build();
    const { application, announced } = await arrange(due);

    await application.commandBus.execute(new ExpireUnconfirmedAppointmentsCommand(holder, AT));
    await application.commandBus.execute(new ExpireUnconfirmedAppointmentsCommand(holder, AT));

    expect(announced).toEqual(['scheduling.appointment.expired']);
    expect(application.eventBus.published).toHaveLength(1);
  });

  it('is refused to an actor who does not hold the permission appointment.expire', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new ExpireUnconfirmedAppointmentsCommand(anActor().build(), AT)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

async function arrange(...stored: readonly Appointment[]) {
  const appointmentRepository = new FakeAppointmentRepository();
  const announced: string[] = [];

  await stored.reduce(
    (saved, appointment) => saved.then(() => appointmentRepository.save(appointment)),
    Promise.resolve(),
  );

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [
      fake(AppointmentRepository, appointmentRepository),
      fake(CalendarRepository, calendars),
      fake(WaitlistRepository, new FakeWaitlistRepository()),
    ],
    now: NOW,
  });

  FACTS.forEach((name) => application.domainEvents.on(name, async () => void announced.push(name)));

  return { application, appointmentRepository, announced };
}
