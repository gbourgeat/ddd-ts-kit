import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { FileStorage, FixedClock, InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { GetAppointmentDocumentQuery } from '@/contexts/scheduling/application/queries/get-appointment-document/get-appointment-document.query';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import type { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { anAttachedDocument } from '@/contexts/scheduling/test/builders/attached-document.builder';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['appointment.read-document']] } }),
});

const holder = anActor().withRole('holder').build();
const NOW = new Date('2026-03-02T09:10:00.000Z');
const KEY = 'appointment-documents/2026/03/document-1';

describe('Get appointment document', () => {
  it('answers a link that downloads the document under its name, for five minutes', async () => {
    const appointment = anAppointment().build();

    appointment.attachDocument(anAttachedDocument(KEY), NOW);

    const { application, files } = await arrange(appointment);

    const found = await application.queryBus.execute(new GetAppointmentDocumentQuery(holder, appointment.id));
    const token = new URL(found.url).searchParams.get('token') ?? '';
    const download = await files.openSigned(token);

    expect(found).toMatchObject({ name: 'referral.pdf', mediaType: 'application/pdf', size: 15 });
    expect(found.expiresAt.getTime() - NOW.getTime()).toBe(300_000);
    expect([download?.metadata.key, download?.fileName]).toEqual([KEY, 'referral.pdf']);
  });

  it('refuses an appointment that holds no document', async () => {
    const appointment = anAppointment().build();
    const { application } = await arrange(appointment);

    await expect(
      application.queryBus.execute(new GetAppointmentDocumentQuery(holder, appointment.id)),
    ).rejects.toMatchObject({ code: 'NO_DOCUMENT' });
  });

  it('refuses an appointment that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.queryBus.execute(new GetAppointmentDocumentQuery(holder, 'appointment-unknown')),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('is refused to an actor who does not hold the permission appointment.read-document', async () => {
    const appointment = anAppointment().build();
    const { application } = await arrange(appointment);

    await expect(
      application.queryBus.execute(new GetAppointmentDocumentQuery(anActor().build(), appointment.id)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

async function arrange(...stored: readonly Appointment[]) {
  const appointmentRepository = new FakeAppointmentRepository();
  const files = new InMemoryFileStorage({ clock: new FixedClock(NOW) });

  await files.put(KEY, Readable.from([Buffer.from('%PDF-1.7 referral')]), { mediaType: 'application/pdf' });

  await stored.reduce(
    (saved, appointment) => saved.then(() => appointmentRepository.save(appointment)),
    Promise.resolve(),
  );

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [fake(AppointmentRepository, appointmentRepository), fake(FileStorage, files)],
    now: NOW,
  });

  return { application, files };
}
