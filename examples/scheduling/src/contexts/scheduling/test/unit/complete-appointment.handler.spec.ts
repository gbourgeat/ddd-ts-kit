import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { CompleteAppointmentCommand } from '@/contexts/scheduling/application/commands/complete-appointment/complete-appointment.command';
import type { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['appointment.complete']] } }),
});

const holder = anActor().withRole('holder').build();
const NOW = new Date('2026-03-02T09:10:00.000Z');
const FACTS = ['scheduling.appointment.completed'] as const;

describe('Complete appointment', () => {
  it('ends the started appointment as completed and answers its identifier', async () => {
    const appointment = started().build();
    const { application, appointmentRepository, announced } = await arrange(appointment);

    const id = await application.commandBus.execute(new CompleteAppointmentCommand(holder, appointment.id));

    expect(id).toBe(appointment.id);
    expect((await appointmentRepository.findById(id))?.status).toBe('completed');
    expect(announced).toEqual(['scheduling.appointment.completed']);

    expect(application.eventBus.published).toMatchObject([
      {
        type: 'scheduling.appointment.completed',
        occurredAt: NOW.toISOString(),
        payload: { appointmentId: appointment.id },
      },
    ]);
  });

  it('is refused to an actor who does not hold the permission appointment.complete', async () => {
    const appointment = started().build();
    const { application } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new CompleteAppointmentCommand(anActor().build(), appointment.id)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses an appointment that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new CompleteAppointmentCommand(holder, 'appointment-unknown')),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('refuses an appointment that has already ended', async () => {
    const cancelled = started().cancelledByPatient().build();
    const { application } = await arrange(cancelled);

    await expect(
      application.commandBus.execute(new CompleteAppointmentCommand(holder, cancelled.id)),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_ENDED' });
  });

  it('saves and publishes nothing before the start of the appointment', async () => {
    const later = anAppointment().startingAt(new Date('2026-03-02T09:30:00.000Z')).build();
    const { application, appointmentRepository, announced } = await arrange(later);

    await expect(
      application.commandBus.execute(new CompleteAppointmentCommand(holder, later.id)),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_STARTED' });

    expect((await appointmentRepository.findById(later.id))?.status).toBe('booked');
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

function started() {
  return anAppointment().startingAt(new Date('2026-03-02T09:00:00.000Z'));
}
