import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { ConfirmAppointmentCommand } from '@/contexts/scheduling/calendars/application/commands/confirm-appointment/confirm-appointment.command';
import type { Appointment } from '@/contexts/scheduling/calendars/domain/aggregates/appointment.aggregate';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['appointment.confirm']] } }),
});

const holder = anActor().withRole('holder').build();
const NOW = new Date('2026-03-01T08:00:00.000Z');
const FACTS = ['scheduling.appointment.confirmed'] as const;

describe('Confirm appointment', () => {
  it('books the requested appointment and answers its identifier', async () => {
    const requested = anAppointment().requestedUntil(new Date('2026-03-01T12:00:00.000Z')).build();
    const { application, appointmentRepository, announced } = await arrange(requested);

    const id = await application.commandBus.execute(new ConfirmAppointmentCommand(holder, requested.id));

    expect(id).toBe(requested.id);
    expect((await appointmentRepository.findById(id))?.status).toBe('booked');
    expect(announced).toEqual(['scheduling.appointment.confirmed']);

    expect(application.eventBus.published).toMatchObject([
      {
        type: 'scheduling.appointment.confirmed',
        occurredAt: NOW.toISOString(),
        payload: { appointmentId: requested.id },
      },
    ]);
  });

  it('is refused to an actor who does not hold the permission appointment.confirm', async () => {
    const requested = anAppointment().requestedUntil(new Date('2026-03-01T12:00:00.000Z')).build();
    const { application } = await arrange(requested);

    await expect(
      application.commandBus.execute(new ConfirmAppointmentCommand(anActor().build(), requested.id)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses an appointment that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new ConfirmAppointmentCommand(holder, 'appointment-unknown')),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('refuses an appointment that is already booked', async () => {
    const booked = anAppointment().build();
    const { application } = await arrange(booked);

    await expect(
      application.commandBus.execute(new ConfirmAppointmentCommand(holder, booked.id)),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_ALREADY_CONFIRMED' });
  });

  it('saves and publishes nothing when the appointment has expired', async () => {
    const expired = anAppointment().expired().build();
    const { application, appointmentRepository, announced } = await arrange(expired);

    await expect(
      application.commandBus.execute(new ConfirmAppointmentCommand(holder, expired.id)),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_ENDED' });

    expect((await appointmentRepository.findById(expired.id))?.status).toBe('expired');
    expect(announced).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });
});

async function arrange(...stored: readonly Appointment[]) {
  const announced: string[] = [];

  const { application, appointmentRepository } = await aSchedulingWorld({
    modules: [holders],
    now: NOW,
    given: async (fakes) => {
      await Promise.all(stored.map((appointment) => fakes.appointmentRepository.save(appointment)));
    },
  });

  FACTS.forEach((name) => application.domainEvents.on(name, async () => void announced.push(name)));

  return { application, appointmentRepository, announced };
}
