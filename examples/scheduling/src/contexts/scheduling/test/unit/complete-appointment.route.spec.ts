import { describe, expect, it } from 'vitest';
import { createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '@/platform/http/error-statuses.js';
import { CompleteAppointmentCommand } from '@/contexts/scheduling/application/commands/complete-appointment/complete-appointment.command.js';
import { AppointmentEndedError } from '@/contexts/scheduling/domain/errors/appointment-ended.error.js';
import { AppointmentNotFoundError } from '@/contexts/scheduling/domain/errors/appointment-not-found.error.js';
import { AppointmentNotStartedError } from '@/contexts/scheduling/domain/errors/appointment-not-started.error.js';
import { completeAppointmentRoute } from '@/contexts/scheduling/presentation/http/complete-appointment.route.js';

// The one table of the platform: a code it does not name answers 422.
const errorMapper = createErrorMapper(errorStatuses);

describe('POST /appointments/:appointmentId/completion', () => {
  it('answers 201 with the identifier of the appointment and hands the use case what the client sent', async () => {
    const received: CompleteAppointmentCommand[] = [];

    const commands = new InMemoryCommandBus().register(CompleteAppointmentCommand, {
      execute: async (command) => {
        received.push(command);

        return 'appointment-1';
      },
    });

    const response = await executeRoute(completeAppointmentRoute(commands), request(undefined), {
      validateResponses: true,
    });

    expect(response).toMatchObject({ status: 201, body: { id: 'appointment-1' } });
    expect(received).toMatchObject([{ appointmentId: 'appointment-1' }]);
  });

  it.each([
    [
      new AppointmentNotStartedError('appointment-1', new Date('2026-03-02T08:00:00.000Z')),
      422,
      'APPOINTMENT_NOT_STARTED',
    ],
    [new AppointmentEndedError('appointment-1', 'cancelled'), 409, 'APPOINTMENT_ENDED'],
    [new AppointmentNotFoundError('appointment-1'), 404, 'APPOINTMENT_NOT_FOUND'],
  ])('answers the refusal %o with the status %i and the code %s', async (refusal, status, code) => {
    const commands = new InMemoryCommandBus().register(CompleteAppointmentCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(completeAppointmentRoute(commands), request(undefined), {
      validateResponses: true,
      errorMapper,
    });

    expect(response).toMatchObject({ status, body: { code } });
  });
});

function request(body: unknown, appointmentId = 'appointment-1') {
  return { params: { appointmentId }, query: {}, headers: {}, body, raw: undefined };
}
