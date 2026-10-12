import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { CreateCalendarCommand } from '@/contexts/scheduling/application/commands/create-calendar/create-calendar.command';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import { createCalendarRoute } from '@/contexts/scheduling/presentation/http/create-calendar.route';

describe('POST /calendars', () => {
  it('answers 201 with the identifier when the use case succeeds', async () => {
    const received: CreateCalendarCommand[] = [];

    const commands = new InMemoryCommandBus().register(CreateCalendarCommand, {
      execute: async (command) => {
        received.push(command);

        return 'calendar-1';
      },
    });

    const response = await executeRoute(
      createCalendarRoute(commands),
      request({ practiceId: 'practice-1', practitionerId: 'practitioner-1' }),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'calendar-1' } });
    expect(received).toMatchObject([{ practiceId: 'practice-1', practitionerId: 'practitioner-1' }]);
  });

  it.each([
    ['without a practitioner', { practiceId: 'practice-1' }],
    ['with an empty practice', { practiceId: '', practitionerId: 'practitioner-1' }],
    ['with a practice that is not a text', { practiceId: 7, practitionerId: 'practitioner-1' }],
  ])('refuses a body %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(CreateCalendarCommand, { execute: async () => 'calendar-1' });

    const response = await executeRoute(createCalendarRoute(commands), request(body), { validateResponses: true });

    expect(response.status).toBe(422);
  });

  it('answers the refusal of an unknown practitioner with its code', async () => {
    const commands = new InMemoryCommandBus().register(CreateCalendarCommand, {
      execute: async () => {
        throw CalendarError.unknownPractitioner('practice-1', 'practitioner-1');
      },
    });

    const response = await executeRoute(
      createCalendarRoute(commands),
      request({ practiceId: 'practice-1', practitionerId: 'practitioner-1' }),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 422, body: { code: 'UNKNOWN_PRACTITIONER' } });
  });
});

function request(body: unknown) {
  return { params: {}, query: {}, headers: {}, body, raw: undefined };
}
