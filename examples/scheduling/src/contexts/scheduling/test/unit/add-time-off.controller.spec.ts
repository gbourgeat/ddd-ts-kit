import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { AddTimeOffCommand } from '@/contexts/scheduling/application/commands/add-time-off/add-time-off.command';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import { AddTimeOffController } from '@/contexts/scheduling/presentation/http/calendars/add-time-off/add-time-off.controller';

const valid = { startsAt: '2026-08-03T00:00:00.000Z', endsAt: '2026-08-17T00:00:00.000+02:00' };

describe('POST /calendars/:calendarId/time-off', () => {
  it('answers 201 with the identifier and hands the use case what the client sent', async () => {
    const received: AddTimeOffCommand[] = [];

    const commands = new InMemoryCommandBus().register(AddTimeOffCommand, {
      execute: async (command) => {
        received.push(command);

        return 'calendar-1';
      },
    });

    const response = await executeRoute(
      controllerRoute(new AddTimeOffController(commands), { guards: 'skip' }),
      request(valid),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'calendar-1' } });

    expect(received).toMatchObject([
      {
        calendarId: 'calendar-1',
        startsAt: new Date('2026-08-03T00:00:00.000Z'),
        endsAt: new Date('2026-08-16T22:00:00.000Z'),
      },
    ]);
  });

  it.each([
    ['a body without an end', { startsAt: '2026-08-03T00:00:00.000Z' }],
    ['a start that is not an instant', { startsAt: 'in August', endsAt: '2026-08-17T00:00:00.000Z' }],
    ['an instant that does not exist', { startsAt: '2026-02-30T00:00:00.000Z', endsAt: '2026-08-17T00:00:00.000Z' }],
  ])('refuses %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(AddTimeOffCommand, { execute: async () => 'calendar-1' });

    const response = await executeRoute(
      controllerRoute(new AddTimeOffController(commands), { guards: 'skip' }),
      request(body),
      { validateResponses: true },
    );

    expect(response.status).toBe(422);
  });

  it('answers the refusal of the use case with its code', async () => {
    const commands = new InMemoryCommandBus().register(AddTimeOffCommand, {
      execute: async () => {
        throw CalendarError.timeOffOverAppointments(2);
      },
    });

    const response = await executeRoute(
      controllerRoute(new AddTimeOffController(commands), { guards: 'skip' }),
      request(valid),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 422, body: { code: 'TIME_OFF_OVER_APPOINTMENTS' } });
  });
});

function request(body: unknown) {
  return { params: { calendarId: 'calendar-1' }, query: {}, headers: {}, body, raw: undefined };
}
