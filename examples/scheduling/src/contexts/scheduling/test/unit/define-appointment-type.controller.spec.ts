import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { DefineAppointmentTypeCommand } from '@/contexts/scheduling/application/commands/define-appointment-type/define-appointment-type.command';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import { DefineAppointmentTypeController } from '@/contexts/scheduling/presentation/http/calendars/define-appointment-type/define-appointment-type.controller';

const valid = { name: 'Consultation', duration: 30, grid: 15, buffer: 10, needsConfirmation: true };

describe('POST /calendars/:calendarId/appointment-types', () => {
  it('answers 201 with the identifier and hands the use case what the client sent', async () => {
    const received: DefineAppointmentTypeCommand[] = [];

    const commands = new InMemoryCommandBus().register(DefineAppointmentTypeCommand, {
      execute: async (command) => {
        received.push(command);

        return 'type-1';
      },
    });

    const response = await executeRoute(
      controllerRoute(new DefineAppointmentTypeController(commands), { guards: 'skip' }),
      request(valid),
      {
        validateResponses: true,
      },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'type-1' } });
    expect(received).toMatchObject([{ calendarId: 'calendar-1', facts: valid }]);
  });

  it.each([
    ['a body without a name', { duration: 30, grid: 15, buffer: 10, needsConfirmation: true }],
    ['a duration that is not whole minutes', { ...valid, duration: 12.5 }],
    ['a confirmation that is not yes or no', { ...valid, needsConfirmation: 'maybe' }],
  ])('refuses %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(DefineAppointmentTypeCommand, { execute: async () => 'type-1' });

    const response = await executeRoute(
      controllerRoute(new DefineAppointmentTypeController(commands), { guards: 'skip' }),
      request(body),
      {
        validateResponses: true,
      },
    );

    expect(response.status).toBe(422);
  });

  it('answers the refusal of the use case with its code', async () => {
    const commands = new InMemoryCommandBus().register(DefineAppointmentTypeCommand, {
      execute: async () => {
        throw CalendarError.invalidAppointmentType('lasts a positive number of minutes');
      },
    });

    const response = await executeRoute(
      controllerRoute(new DefineAppointmentTypeController(commands), { guards: 'skip' }),
      request(valid),
      {
        validateResponses: true,
      },
    );

    expect(response).toMatchObject({ status: 422, body: { code: 'INVALID_APPOINTMENT_TYPE' } });
  });
});

function request(body: unknown) {
  return { params: { calendarId: 'calendar-1' }, query: {}, headers: {}, body, raw: undefined };
}
