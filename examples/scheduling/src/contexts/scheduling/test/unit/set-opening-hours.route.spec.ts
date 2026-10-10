import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { SetOpeningHoursCommand } from '../../application/commands/set-opening-hours/set-opening-hours.command.js';
import { InvalidRangeError } from '../../domain/errors/invalid-range.error.js';
import { setOpeningHoursRoute } from '../../presentation/http/set-opening-hours.route.js';

const valid = { ranges: [{ weekday: 'monday', start: '09:00', end: '12:00' }] };

describe('PUT /calendars/:calendarId/opening-hours', () => {
  it('answers 200 with the identifier and hands the use case what the client sent', async () => {
    const received: SetOpeningHoursCommand[] = [];

    const commands = new InMemoryCommandBus().register(SetOpeningHoursCommand, {
      execute: async (command) => {
        received.push(command);

        return 'calendar-1';
      },
    });

    const response = await executeRoute(setOpeningHoursRoute(commands), request(valid), { validateResponses: true });

    expect(response).toMatchObject({ status: 200, body: { id: 'calendar-1' } });

    expect(received).toMatchObject([
      { calendarId: 'calendar-1', ranges: [{ weekday: 'monday', start: '09:00', end: '12:00' }] },
    ]);
  });

  it.each([
    ['a weekday that does not exist', { ranges: [{ weekday: 'someday', start: '09:00', end: '12:00' }] }],
    ['a time that is not written HH:MM', { ranges: [{ weekday: 'monday', start: '9h', end: '12:00' }] }],
    ['ranges that are not a list', { ranges: 'always' }],
  ])('refuses %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(SetOpeningHoursCommand, { execute: async () => 'calendar-1' });

    const response = await executeRoute(setOpeningHoursRoute(commands), request(body), { validateResponses: true });

    expect(response.status).toBe(422);
  });

  it('answers the refusal of the use case with its code', async () => {
    const commands = new InMemoryCommandBus().register(SetOpeningHoursCommand, {
      execute: async () => {
        throw new InvalidRangeError('ends after it starts');
      },
    });

    const response = await executeRoute(setOpeningHoursRoute(commands), request(valid), { validateResponses: true });

    expect(response).toMatchObject({ status: 422, body: { code: 'INVALID_RANGE' } });
  });
});

function request(body: unknown) {
  return { params: { calendarId: 'calendar-1' }, query: {}, headers: {}, body, raw: undefined };
}
