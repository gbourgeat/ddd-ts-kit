import { describe, expect, it } from 'vitest';
import { createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '../../../../platform/http/error-statuses.js';
import { ConfirmAppointmentCommand } from '../../application/commands/confirm-appointment/confirm-appointment.command.js';
import { AppointmentAlreadyConfirmedError } from '../../domain/errors/appointment-already-confirmed.error.js';
import { AppointmentEndedError } from '../../domain/errors/appointment-ended.error.js';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error.js';
import { confirmAppointmentRoute } from '../../presentation/http/confirm-appointment.route.js';

// The one table of the platform: a code it does not name answers 422.
const errorMapper = createErrorMapper(errorStatuses);

describe('POST /appointments/:appointmentId/confirmation', () => {
  it('answers 201 with the identifier of the appointment and hands the use case what the client sent', async () => {
    const received: ConfirmAppointmentCommand[] = [];

    const commands = new InMemoryCommandBus().register(ConfirmAppointmentCommand, {
      execute: async (command) => {
        received.push(command);

        return 'appointment-1';
      },
    });

    const response = await executeRoute(confirmAppointmentRoute(commands), request(undefined), {
      validateResponses: true,
    });

    expect(response).toMatchObject({ status: 201, body: { id: 'appointment-1' } });
    expect(received).toMatchObject([{ appointmentId: 'appointment-1' }]);
  });

  it.each([
    [new AppointmentAlreadyConfirmedError('appointment-1'), 409, 'APPOINTMENT_ALREADY_CONFIRMED'],
    [new AppointmentEndedError('appointment-1', 'expired'), 409, 'APPOINTMENT_ENDED'],
    [new AppointmentNotFoundError('appointment-1'), 404, 'APPOINTMENT_NOT_FOUND'],
  ])('answers the refusal %o with the status %i and the code %s', async (refusal, status, code) => {
    const commands = new InMemoryCommandBus().register(ConfirmAppointmentCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(confirmAppointmentRoute(commands), request(undefined), {
      validateResponses: true,
      errorMapper,
    });

    expect(response).toMatchObject({ status, body: { code } });
  });
});

function request(body: unknown, appointmentId = 'appointment-1') {
  return { params: { appointmentId }, query: {}, headers: {}, body, raw: undefined };
}
