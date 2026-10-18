import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { AddExceptionCommand } from '@/contexts/scheduling/application/commands/add-exception/add-exception.command';
import { InvalidDay } from '@/contexts/scheduling/domain/errors/invalid-day.error';
import { AddExceptionController } from '@/contexts/scheduling/presentation/http/calendars/add-exception/add-exception.controller';

const valid = { day: '2026-05-01', ranges: [{ start: '10:00', end: '12:00' }] };

describe('POST /calendars/:calendarId/exceptions', () => {
  it('answers 201 with the identifier and hands the use case what the client sent', async () => {
    const received: AddExceptionCommand[] = [];

    const commands = new InMemoryCommandBus().register(AddExceptionCommand, {
      execute: async (command) => {
        received.push(command);

        return 'calendar-1';
      },
    });

    const response = await executeRoute(
      controllerRoute(new AddExceptionController(commands), { guards: 'skip' }),
      request(valid),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'calendar-1' } });

    expect(received).toMatchObject([
      { calendarId: 'calendar-1', day: '2026-05-01', ranges: [{ start: '10:00', end: '12:00' }] },
    ]);
  });

  it.each([
    ['a body without a day', { ranges: [] }],
    ['a day that is not written YYYY-MM-DD', { day: '01/05/2026', ranges: [] }],
    ['a time that is not written HH:MM', { day: '2026-05-01', ranges: [{ start: '10', end: '12:00' }] }],
  ])('refuses %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(AddExceptionCommand, { execute: async () => 'calendar-1' });

    const response = await executeRoute(
      controllerRoute(new AddExceptionController(commands), { guards: 'skip' }),
      request(body),
      { validateResponses: true },
    );

    expect(response.status).toBe(422);
  });

  it('answers the refusal of the use case with its code', async () => {
    const commands = new InMemoryCommandBus().register(AddExceptionCommand, {
      execute: async () => {
        throw InvalidDay.forDay('2026-02-30');
      },
    });

    const response = await executeRoute(
      controllerRoute(new AddExceptionController(commands), { guards: 'skip' }),
      request(valid),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 422, body: { code: 'INVALID_DAY' } });
  });
});

function request(body: unknown) {
  return { params: { calendarId: 'calendar-1' }, query: {}, headers: {}, body, raw: undefined };
}
