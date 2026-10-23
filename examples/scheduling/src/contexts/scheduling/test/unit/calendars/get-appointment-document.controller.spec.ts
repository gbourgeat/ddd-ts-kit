import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus, type Actor } from '@ddd-ts-kit/kernel';
import { GetAppointmentDocumentQuery } from '@/contexts/scheduling/calendars/application/queries/get-appointment-document/get-appointment-document.query';
import { GetAppointmentDocumentController } from '@/contexts/scheduling/calendars/presentation/http/appointments/get-appointment-document/get-appointment-document.controller';

const caller: Actor = { id: 'user-1', type: 'user', roles: [], attributes: {} };

describe('GET /appointments/:appointmentId/document', () => {
  it('answers the link to the document, and when it expires', async () => {
    const expiresAt = new Date('2026-03-02T09:15:00.000Z');
    const url = 'https://files.example.com/appointment-documents/doc-1?signature=abc';

    const queries = new InMemoryQueryBus().register(GetAppointmentDocumentQuery, {
      execute: async () => ({ url, expiresAt, name: 'referral.pdf', mediaType: 'application/pdf', size: 15 }),
    });

    const route = controllerRoute(new GetAppointmentDocumentController(queries));

    const response = await executeRoute(
      route,
      { params: { appointmentId: 'appointment-id-1' }, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      url,
      expiresAt: expiresAt.toISOString(),
      name: 'referral.pdf',
      mediaType: 'application/pdf',
      size: 15,
    });

    expect(route.path).toBe('/appointments/:appointmentId/document');
  });

  // TODO(domain): replace each entry below by a test of the contract a client relies on.
  it.todo('answers 404 to an appointment that holds no document');
});
