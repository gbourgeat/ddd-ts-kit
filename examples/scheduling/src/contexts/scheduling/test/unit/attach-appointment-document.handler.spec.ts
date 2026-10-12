import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { FileStorage, InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { AttachAppointmentDocumentCommand } from '@/contexts/scheduling/application/commands/attach-appointment-document/attach-appointment-document.command';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import type { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['appointment.attach-document']] } }),
});

const holder = anActor().withRole('holder').build();
const NOW = new Date('2026-03-02T09:10:00.000Z');
const PDF = '%PDF-1.7\n%%EOF\n';

describe('Attach appointment document', () => {
  it('keeps the file under a key of its own and records its reference on the appointment, visible once committed', async () => {
    const appointment = anAppointment().build();
    const { application, appointmentRepository, files } = await arrange(appointment);

    const key = await application.commandBus.execute(
      new AttachAppointmentDocumentCommand(holder, appointment.id, aScan('referral.pdf')),
    );

    const document = (await appointmentRepository.findById(appointment.id))?.document;

    expect([document?.name, document?.attachedAt]).toEqual(['referral.pdf', NOW]);
    expect(document?.file).toMatchObject({ key, size: PDF.length, mediaType: 'application/pdf' });
    expect(files.keys()).toEqual([key]);
  });

  it('replaces the document the appointment held, whose file is deleted once the change is committed', async () => {
    const appointment = anAppointment().build();
    const { application, files } = await arrange(appointment);

    const first = await application.commandBus.execute(
      new AttachAppointmentDocumentCommand(holder, appointment.id, aScan()),
    );

    const second = await application.commandBus.execute(
      new AttachAppointmentDocumentCommand(holder, appointment.id, aScan()),
    );

    expect(first).not.toBe(second);
    expect(files.keys()).toEqual([second]);
  });

  it('leaves no visible file when the command is refused: what it staged waits for the purge', async () => {
    const appointment = anAppointment().build();
    const { application, appointmentRepository, files } = await arrange(appointment);
    const command = new AttachAppointmentDocumentCommand(holder, appointment.id, aScan('a'.repeat(201)));

    await expect(application.commandBus.execute(command)).rejects.toMatchObject({ code: 'DOCUMENT_NAME_TOO_LONG' });

    expect((await appointmentRepository.findById(appointment.id))?.document).toBeUndefined();
    expect(files.keys().every((key) => key.startsWith('staging/'))).toBe(true);
  });

  it('refuses an appointment that does not exist, before reading the file', async () => {
    const { application, files } = await arrange();

    await expect(
      application.commandBus.execute(new AttachAppointmentDocumentCommand(holder, 'appointment-unknown', aScan())),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });

    expect(files.keys()).toEqual([]);
  });

  it('is refused to an actor who does not hold the permission appointment.attach-document', async () => {
    const appointment = anAppointment().build();
    const { application } = await arrange(appointment);

    await expect(
      application.commandBus.execute(new AttachAppointmentDocumentCommand(anActor().build(), appointment.id, aScan())),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

function aScan(fileName = 'scan.pdf') {
  return { fileName, mediaType: 'application/pdf', stream: Readable.from([Buffer.from(PDF)]) };
}

async function arrange(...stored: readonly Appointment[]) {
  const appointmentRepository = new FakeAppointmentRepository();
  const files = new InMemoryFileStorage();

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
