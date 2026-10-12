import { describe, expect, it } from 'vitest';
import { controllerRoute, createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '@/platform/http/error-statuses';
import { MarkAppointmentNoShowCommand } from '@/contexts/scheduling/application/commands/mark-appointment-no-show/mark-appointment-no-show.command';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import { MarkAppointmentNoShowController } from '@/contexts/scheduling/presentation/http/appointments/mark-appointment-no-show/mark-appointment-no-show.controller';

// The one table of the platform: a code it does not name answers 422.
const errorMapper = createErrorMapper(errorStatuses);

describe('POST /appointments/:appointmentId/no-show', () => {
  it('answers 201 with the identifier of the appointment and hands the use case what the client sent', async () => {
    const received: MarkAppointmentNoShowCommand[] = [];

    const commands = new InMemoryCommandBus().register(MarkAppointmentNoShowCommand, {
      execute: async (command) => {
        received.push(command);

        return 'appointment-1';
      },
    });

    const response = await executeRoute(
      controllerRoute(new MarkAppointmentNoShowController(commands), { guards: 'skip' }),
      request(undefined),
      {
        validateResponses: true,
      },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'appointment-1' } });
    expect(received).toMatchObject([{ appointmentId: 'appointment-1' }]);
  });

  it.each([
    [
      AppointmentError.notStarted('appointment-1', new Date('2026-03-02T08:00:00.000Z')),
      422,
      'APPOINTMENT_NOT_STARTED',
    ],
    [AppointmentError.ended('appointment-1', 'cancelled'), 409, 'APPOINTMENT_ENDED'],
    [AppointmentError.notFound('appointment-1'), 404, 'APPOINTMENT_NOT_FOUND'],
  ])('answers the refusal %o with the status %i and the code %s', async (refusal, status, code) => {
    const commands = new InMemoryCommandBus().register(MarkAppointmentNoShowCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(
      controllerRoute(new MarkAppointmentNoShowController(commands), { guards: 'skip' }),
      request(undefined),
      {
        validateResponses: true,
        errorMapper,
      },
    );

    expect(response).toMatchObject({ status, body: { code } });
  });
});

function request(body: unknown, appointmentId = 'appointment-1') {
  return { params: { appointmentId }, query: {}, headers: {}, body, raw: undefined };
}
