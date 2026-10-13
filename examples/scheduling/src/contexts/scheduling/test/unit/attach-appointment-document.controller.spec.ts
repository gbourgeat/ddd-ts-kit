import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { AttachAppointmentDocumentCommand } from '@/contexts/scheduling/application/commands/attach-appointment-document/attach-appointment-document.command';
import { AttachAppointmentDocumentController } from '@/contexts/scheduling/presentation/http/appointments/attach-appointment-document/attach-appointment-document.controller';

const caller: Actor = { id: 'user-1', type: 'user', roles: [], attributes: {} };

describe('POST /appointments/:appointmentId/document', () => {
  it('declares the file it receives, and hands it to the command as it streams', async () => {
    const received: string[] = [];

    const commands = new InMemoryCommandBus().register(AttachAppointmentDocumentCommand, {
      execute: async ({ appointmentId, document }) => {
        received.push(`${appointmentId} ${document.fileName}`);

        return 'file-1';
      },
    });

    const route = controllerRoute(new AttachAppointmentDocumentController(commands));
    const file = { fileName: 'scan.pdf', mediaType: 'application/pdf', stream: Readable.from([Buffer.from('%PDF-')]) };

    const response = await executeRoute(
      route,
      { params: { appointmentId: 'appointment-id-1' }, query: {}, headers: {}, body: {}, raw: undefined },
      {
        validateResponses: true,
        uploads: async () => ({ fields: {}, file }),
        resolvePrincipal: () => caller,
      },
    );

    expect([response.status, response.body]).toEqual([201, { id: 'appointment-id-1' }]);
    expect(received).toEqual(['appointment-id-1 scan.pdf']);

    expect(route.upload).toEqual({
      field: 'document',
      maxBytes: 10_485_760,
      mediaTypes: ['application/pdf', 'image/png', 'image/jpeg'],
    });
  });

  it.todo('answers 404 to an appointment that does not exist');
});
