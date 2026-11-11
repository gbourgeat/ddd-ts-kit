import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { RemoveAppointmentDocumentCommand } from '@/contexts/scheduling/calendars/application/commands/remove-appointment-document/remove-appointment-document.command';
import { RemoveAppointmentDocumentController } from '@/contexts/scheduling/calendars/presentation/http/appointments/remove-appointment-document/remove-appointment-document.controller';

const caller: Actor = { id: 'user-1', type: 'user', roles: [], attributes: {} };

describe('DELETE /appointments/:appointmentId/document', () => {
  it('takes the document off the appointment of the path, and answers its identifier', async () => {
    const commands = new InMemoryCommandBus().register(RemoveAppointmentDocumentCommand, {
      execute: async ({ appointmentId }) => appointmentId,
    });

    const route = controllerRoute(new RemoveAppointmentDocumentController(commands));

    const response = await executeRoute(
      route,
      { params: { appointmentId: 'appointment-id-1' }, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect([response.status, response.body]).toEqual([200, { id: 'appointment-id-1' }]);
    expect(route.path).toBe('/appointments/:appointmentId/document');
  });

  it.todo('answers 404 to an appointment that holds no document');
});
