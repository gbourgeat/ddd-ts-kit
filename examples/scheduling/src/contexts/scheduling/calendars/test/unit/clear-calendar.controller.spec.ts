import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { ClearCalendarCommand } from '@/contexts/scheduling/calendars/application/commands/clear-calendar/clear-calendar.command';
import { UnknownCalendar } from '@/contexts/scheduling/calendars/domain/errors/unknown-calendar.error';
import { ClearCalendarController } from '@/contexts/scheduling/calendars/presentation/http/calendars/clear-calendar/clear-calendar.controller';

const valid = {
  startsAt: '2026-08-03T00:00:00.000Z',
  endsAt: '2026-08-17T00:00:00.000+02:00',
  reason: 'The practitioner is away',
};

describe('POST /calendars/:calendarId/clearances', () => {
  it('answers 202 with the clearance and hands the use case what the client sent', async () => {
    const received: ClearCalendarCommand[] = [];

    const commands = new InMemoryCommandBus().register(ClearCalendarCommand, {
      execute: async (command) => {
        received.push(command);

        return 'clearance-1';
      },
    });

    const response = await executeRoute(
      controllerRoute(new ClearCalendarController(commands), { guards: 'skip' }),
      request(valid),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 202, body: { id: 'clearance-1' } });

    expect(received).toMatchObject([
      {
        calendarId: 'calendar-1',
        startsAt: new Date('2026-08-03T00:00:00.000Z'),
        endsAt: new Date('2026-08-16T22:00:00.000Z'),
        reason: valid.reason,
      },
    ]);
  });

  it.each([
    ['a body without a reason', { startsAt: valid.startsAt, endsAt: valid.endsAt }],
    ['an empty reason', { ...valid, reason: '' }],
    ['a start that is not an instant', { ...valid, startsAt: 'in August' }],
  ])('refuses %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(ClearCalendarCommand, { execute: async () => 'clearance-1' });

    const response = await executeRoute(
      controllerRoute(new ClearCalendarController(commands), { guards: 'skip' }),
      request(body),
      { validateResponses: true },
    );

    expect(response.status).toBe(422);
  });

  it('answers the refusal of the use case with its code', async () => {
    const commands = new InMemoryCommandBus().register(ClearCalendarCommand, {
      execute: async () => {
        throw UnknownCalendar.forCalendar('calendar-1');
      },
    });

    const response = await executeRoute(
      controllerRoute(new ClearCalendarController(commands), { guards: 'skip' }),
      request(valid),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ body: { code: 'UNKNOWN_CALENDAR' } });
  });
});

function request(body: unknown) {
  return { params: { calendarId: 'calendar-1' }, query: {}, headers: {}, body, raw: undefined };
}
