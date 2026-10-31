import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, fake } from '@ddd-ts-kit/di';
import { createTestApplication } from '@ddd-ts-kit/di/tsyringe';
import { FileStorage, InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { RemoveAppointmentDocumentCommand } from '@/contexts/scheduling/calendars/application/commands/remove-appointment-document/remove-appointment-document.command';
import { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import type { Appointment } from '@/contexts/scheduling/calendars/domain/aggregates/appointment.aggregate';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { anAttachedDocument } from '@/contexts/scheduling/test/builders/attached-document.builder';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['appointment.remove-document']] } }),
});

const holder = anActor().withRole('holder').build();
const NOW = new Date('2026-03-02T09:10:00.000Z');
const KEY = 'appointment-documents/2026/03/document-1';

describe('Remove appointment document', () => {
  it('takes the document off the appointment, and deletes its file once the change is committed', async () => {
    const appointment = withDocument();
    const { application, appointmentRepository, files } = await arrange(appointment);

    const id = await application.commandBus.execute(new RemoveAppointmentDocumentCommand(holder, appointment.id));

    expect(id).toBe(appointment.id);
    expect((await appointmentRepository.findById(id))?.document).toBeUndefined();
    expect(files.keys()).toEqual([]);
  });

  it('refuses an appointment that holds no document, and keeps every file', async () => {
    const appointment = anAppointment().build();
    const { application, files } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new RemoveAppointmentDocumentCommand(holder, appointment.id)),
    ).rejects.toMatchObject({ code: 'NO_DOCUMENT' });

    expect(files.keys()).toEqual([KEY]);
  });

  it('refuses an appointment that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new RemoveAppointmentDocumentCommand(holder, 'appointment-unknown')),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('is refused to an actor who does not hold the permission appointment.remove-document', async () => {
    const appointment = withDocument();
    const { application, files } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new RemoveAppointmentDocumentCommand(anActor().build(), appointment.id)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(files.keys()).toEqual([KEY]);
  });
});

function withDocument(): Appointment {
  const appointment = anAppointment().build();

  appointment.attachDocument(anAttachedDocument(KEY), NOW);

  return appointment;
}

async function arrange(...stored: readonly Appointment[]) {
  const appointmentRepository = new FakeAppointmentRepository();
  const files = new InMemoryFileStorage();

  await files.put(KEY, Readable.from([Buffer.from('%PDF-1.7')]), { mediaType: 'application/pdf' });

  await stored.reduce(
    (saved, appointment) => saved.then(() => appointmentRepository.save(appointment)),
    Promise.resolve(),
  );

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [fake(AppointmentRepository, appointmentRepository), fake(FileStorage, files)],
    now: NOW,
  });

  return { application, appointmentRepository, files };
}
