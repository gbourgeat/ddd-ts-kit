import { describe, expect, it } from 'vitest';
import { controllerRoute, createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '@/platform/http/error-statuses';
import { RescheduleAppointmentCommand } from '@/contexts/scheduling/calendars/application/commands/reschedule-appointment/reschedule-appointment.command';
import { AppointmentEnded } from '@/contexts/scheduling/calendars/domain/errors/appointment-ended.error';
import { UnknownAppointment } from '@/contexts/scheduling/calendars/domain/errors/unknown-appointment.error';
import { SlotTaken } from '@/contexts/scheduling/calendars/domain/errors/slot-taken.error';
import { RescheduleAppointmentController } from '@/contexts/scheduling/calendars/presentation/http/appointments/reschedule-appointment/reschedule-appointment.controller';

// The one table of the platform: a code it does not name answers 422.
const errorMapper = createErrorMapper(errorStatuses);

describe('POST /appointments/:appointmentId/reschedule', () => {
  it('answers 201 with the identifier of the appointment and hands the use case what the client sent', async () => {
    const received: RescheduleAppointmentCommand[] = [];

    const commands = new InMemoryCommandBus().register(RescheduleAppointmentCommand, {
      execute: async (command) => {
        received.push(command);

        return 'appointment-1';
      },
    });

    const response = await executeRoute(
      controllerRoute(new RescheduleAppointmentController(commands), { guards: 'skip' }),
      request({ startsAt: '2026-03-02T14:00:00+01:00' }),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'appointment-1' } });

    expect(received).toMatchObject([
      { appointmentId: 'appointment-1', startsAt: new Date('2026-03-02T13:00:00.000Z') },
    ]);
  });

  it.each([
    ['without a start', {}],
    ['whose start is no instant', { startsAt: 'later' }],
  ])('refuses a body %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(RescheduleAppointmentCommand, {
      execute: async () => 'appointment-1',
    });

    const response = await executeRoute(
      controllerRoute(new RescheduleAppointmentController(commands), { guards: 'skip' }),
      request(body),
      {
        validateResponses: true,
      },
    );

    expect(response.status).toBe(422);
  });

  it.each([
    [SlotTaken.forCalendar('calendar-1', new Date('2026-03-02T13:00:00.000Z')), 409, 'SLOT_TAKEN'],
    [AppointmentEnded.forAppointment('appointment-1', 'cancelled'), 409, 'APPOINTMENT_ENDED'],
    [UnknownAppointment.forAppointment('appointment-1'), 404, 'APPOINTMENT_NOT_FOUND'],
  ])('answers the refusal %o with the status %i and the code %s', async (refusal, status, code) => {
    const commands = new InMemoryCommandBus().register(RescheduleAppointmentCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(
      controllerRoute(new RescheduleAppointmentController(commands), { guards: 'skip' }),
      request({ startsAt: '2026-03-02T14:00:00+01:00' }),
      { validateResponses: true, errorMapper },
    );

    expect(response).toMatchObject({ status, body: { code } });
  });
});

function request(body: unknown, appointmentId = 'appointment-1') {
  return { params: { appointmentId }, query: {}, headers: {}, body, raw: undefined };
}
