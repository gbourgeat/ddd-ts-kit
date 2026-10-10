import { describe, expect, it } from 'vitest';
import { createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '../../../../platform/http/error-statuses.js';
import { CancelAppointmentCommand } from '../../application/commands/cancel-appointment/cancel-appointment.command.js';
import { AppointmentEndedError } from '../../domain/errors/appointment-ended.error.js';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error.js';
import { ReasonRequiredError } from '../../domain/errors/reason-required.error.js';
import { cancelAppointmentRoute } from '../../presentation/http/cancel-appointment.route.js';

// The one table of the platform: a code it does not name answers 422.
const errorMapper = createErrorMapper(errorStatuses);

describe('POST /appointments/:appointmentId/cancellation', () => {
  it('answers 201 with the identifier of the appointment and hands the use case what the client sent', async () => {
    const received: CancelAppointmentCommand[] = [];

    const commands = new InMemoryCommandBus().register(CancelAppointmentCommand, {
      execute: async (command) => {
        received.push(command);

        return 'appointment-1';
      },
    });

    const response = await executeRoute(cancelAppointmentRoute(commands), request({ reason: 'The practitioner is away.' }), { validateResponses: true });

    expect(response).toMatchObject({ status: 201, body: { id: 'appointment-1' } });
    expect(received).toMatchObject([{ appointmentId: 'appointment-1', reason: 'The practitioner is away.' }]);
  });

  it.each([
    ['whose reason is not a text', { reason: 7 }],
    ['whose reason is longer than 500 characters', { reason: 'x'.repeat(501) }],
  ])('refuses a body %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(CancelAppointmentCommand, { execute: async () => 'appointment-1' });

    const response = await executeRoute(cancelAppointmentRoute(commands), request(body), { validateResponses: true });

    expect(response.status).toBe(422);
  });

  it.each([
    [new ReasonRequiredError(), 422, 'REASON_REQUIRED'],
    [new AppointmentEndedError('appointment-1', 'completed'), 409, 'APPOINTMENT_ENDED'],
    [new AppointmentNotFoundError('appointment-1'), 404, 'APPOINTMENT_NOT_FOUND'],
  ])('answers the refusal %o with the status %i and the code %s', async (refusal, status, code) => {
    const commands = new InMemoryCommandBus().register(CancelAppointmentCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(cancelAppointmentRoute(commands), request({ reason: 'The practitioner is away.' }), { validateResponses: true, errorMapper });

    expect(response).toMatchObject({ status, body: { code } });
  });
});

function request(body: unknown, appointmentId = 'appointment-1') {
  return { params: { appointmentId }, query: {}, headers: {}, body, raw: undefined };
}
