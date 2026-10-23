import { describe, expect, it } from 'vitest';
import { controllerRoute, createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '@/platform/http/error-statuses';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/calendars/commands/cancel-appointment/cancel-appointment.command';
import { AppointmentEnded } from '@/contexts/scheduling/domain/calendars/errors/appointment-ended.error';
import { UnknownAppointment } from '@/contexts/scheduling/domain/calendars/errors/unknown-appointment.error';
import { ReasonRequired } from '@/contexts/scheduling/domain/calendars/errors/reason-required.error';
import { CancelAppointmentController } from '@/contexts/scheduling/presentation/http/appointments/cancel-appointment/cancel-appointment.controller';

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

    const response = await executeRoute(
      controllerRoute(new CancelAppointmentController(commands), { guards: 'skip' }),
      request({ reason: 'The practitioner is away.' }),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'appointment-1' } });
    expect(received).toMatchObject([{ appointmentId: 'appointment-1', reason: 'The practitioner is away.' }]);
  });

  it.each([
    ['whose reason is not a text', { reason: 7 }],
    ['whose reason is longer than 500 characters', { reason: 'x'.repeat(501) }],
  ])('refuses a body %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(CancelAppointmentCommand, {
      execute: async () => 'appointment-1',
    });

    const response = await executeRoute(
      controllerRoute(new CancelAppointmentController(commands), { guards: 'skip' }),
      request(body),
      { validateResponses: true },
    );

    expect(response.status).toBe(422);
  });

  it.each([
    [ReasonRequired.onCancellation(), 422, 'REASON_REQUIRED'],
    [AppointmentEnded.forAppointment('appointment-1', 'completed'), 409, 'APPOINTMENT_ENDED'],
    [UnknownAppointment.forAppointment('appointment-1'), 404, 'APPOINTMENT_NOT_FOUND'],
  ])('answers the refusal %o with the status %i and the code %s', async (refusal, status, code) => {
    const commands = new InMemoryCommandBus().register(CancelAppointmentCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(
      controllerRoute(new CancelAppointmentController(commands), { guards: 'skip' }),
      request({ reason: 'The practitioner is away.' }),
      { validateResponses: true, errorMapper },
    );

    expect(response).toMatchObject({ status, body: { code } });
  });
});

function request(body: unknown, appointmentId = 'appointment-1') {
  return { params: { appointmentId }, query: {}, headers: {}, body, raw: undefined };
}
