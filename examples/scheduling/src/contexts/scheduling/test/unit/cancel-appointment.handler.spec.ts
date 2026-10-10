import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '../../scheduling.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { schedulingPermissions } from '../../application/authorization/scheduling.permissions.js';
import { CancelAppointmentCommand } from '../../application/commands/cancel-appointment/cancel-appointment.command.js';
import { AppointmentRepository } from '../../domain/repositories/appointment.repository.js';
import { CalendarRepository } from '../../domain/repositories/calendar.repository.js';
import { WaitlistRepository } from '../../domain/repositories/waitlist.repository.js';
import type { Appointment } from '../../domain/aggregates/appointment.aggregate.js';
import { anAppointment } from '../builders/appointment.builder.js';
import { aCalendar } from '../builders/calendar.builder.js';
import { FakeAppointmentRepository } from '../fakes/appointment.repository.fake.js';
import { FakeWaitlistRepository } from '../fakes/waitlist.repository.fake.js';

const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['appointment.cancel']], system: [schedulingPermissions['waitlist.offer']] }, systemRole: 'system' }) });
const holder = anActor().withRole('holder').build();
// A freed slot is offered to the waitlist of its calendar: every calendar exists here, and nobody waits.
const calendars = { findById: async (id: string) => aCalendar().identifiedBy(id).build(), save: async () => undefined };
const NOW = new Date('2026-03-01T09:00:00.000Z');
const patient = anActor().named('patient-1').withRole('holder').build();
const FACTS = ['scheduling.appointment.cancelled'] as const;

describe('Cancel appointment', () => {
  it('lets the patient cancel without a reason until 24 hours before the start', async () => {
    const appointment = tomorrow().build();
    const { application, appointmentRepository, announced } = await arrange(appointment);

    const id = await application.commandBus.execute(new CancelAppointmentCommand(patient, appointment.id));

    const stored = await appointmentRepository.findById(id);

    expect(id).toBe(appointment.id);
    expect(stored?.status).toBe('cancelled');
    expect(stored?.cancellation?.by).toBe('patient');
    expect(announced).toEqual(['scheduling.appointment.cancelled']);
    expect(application.eventBus.published).toMatchObject([{ type: 'scheduling.appointment.cancelled', payload: { appointmentId: appointment.id, cancelledBy: 'patient' } }]);
  });

  it('refuses the patient who cancels less than 24 hours before the start, naming the rule', async () => {
    const appointment = tomorrow().startingAt(new Date('2026-03-02T08:59:00.000Z')).build();
    const { application, appointmentRepository, announced } = await arrange(appointment);

    await expect(application.commandBus.execute(new CancelAppointmentCommand(patient, appointment.id))).rejects.toMatchObject({ code: 'FORBIDDEN', reason: 'scheduling.patient-cancels-until-notice' });

    expect((await appointmentRepository.findById(appointment.id))?.status).toBe('booked');
    expect(announced).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });

  it('lets the practice cancel at any time with the reason it gives', async () => {
    const appointment = tomorrow().startingAt(new Date('2026-03-01T10:00:00.000Z')).build();
    const { application, appointmentRepository } = await arrange(appointment);

    await application.commandBus.execute(new CancelAppointmentCommand(holder, appointment.id, 'The practitioner is away.'));

    const stored = await appointmentRepository.findById(appointment.id);

    expect(stored?.cancellation?.by).toBe('practice');
    expect(stored?.cancellation?.reason).toBe('The practitioner is away.');
    expect(application.eventBus.published).toMatchObject([{ payload: { cancelledBy: 'practice' } }]);
  });

  it('refuses the practice that cancels without a reason, and saves nothing', async () => {
    const appointment = tomorrow().build();
    const { application, appointmentRepository, announced } = await arrange(appointment);

    await expect(application.commandBus.execute(new CancelAppointmentCommand(holder, appointment.id, '  '))).rejects.toMatchObject({ code: 'REASON_REQUIRED' });

    expect((await appointmentRepository.findById(appointment.id))?.status).toBe('booked');
    expect(announced).toEqual([]);
  });

  it('is refused to an actor who does not hold the permission appointment.cancel', async () => {
    const appointment = tomorrow().build();
    const { application } = await arrange(appointment);

    await expect(application.commandBus.execute(new CancelAppointmentCommand(anActor().build(), appointment.id, 'No reason.'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses an appointment that does not exist', async () => {
    const { application } = await arrange();

    await expect(application.commandBus.execute(new CancelAppointmentCommand(holder, 'appointment-unknown', 'A reason.'))).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('refuses an appointment that has already ended', async () => {
    const completed = tomorrow().startingAt(new Date('2026-02-27T09:00:00.000Z')).completed().build();
    const { application } = await arrange(completed);

    await expect(application.commandBus.execute(new CancelAppointmentCommand(holder, completed.id, 'A reason.'))).rejects.toMatchObject({ code: 'APPOINTMENT_ENDED' });
  });
});

async function arrange(...stored: readonly Appointment[]) {
  const appointmentRepository = new FakeAppointmentRepository();
  const announced: string[] = [];

  await stored.reduce((saved, appointment) => saved.then(() => appointmentRepository.save(appointment)), Promise.resolve());

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [fake(AppointmentRepository, appointmentRepository), fake(CalendarRepository, calendars), fake(WaitlistRepository, new FakeWaitlistRepository())],
    now: NOW,
  });

  FACTS.forEach((name) => application.domainEvents.on(name, async () => void announced.push(name)));

  return { application, appointmentRepository, announced };
}

function tomorrow() {
  return anAppointment().forPatient('patient-1').startingAt(new Date('2026-03-02T09:00:00.000Z'));
}
