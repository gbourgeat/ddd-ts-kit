import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { GetClearanceQuery } from '@/contexts/scheduling/application/calendars/queries/get-clearance/get-clearance.query';
import { UnknownClearance } from '@/contexts/scheduling/domain/calendars/errors/unknown-clearance.error';
import { GetClearanceController } from '@/contexts/scheduling/presentation/http/calendars/get-clearance/get-clearance.controller';

const PARAMS = { calendarId: 'calendar-1', clearanceId: 'clearance-1' };

describe('GET /calendars/:calendarId/clearances/:clearanceId', () => {
  it('answers 200 with how far the clearance went, for the calendar and the clearance of the path', async () => {
    const received: GetClearanceQuery[] = [];

    const queries = new InMemoryQueryBus().register(GetClearanceQuery, {
      execute: async (query) => {
        received.push(query);

        return { clearanceId: 'clearance-1', status: 'running' as const, attempts: 1, done: 120, total: 450 };
      },
    });

    const response = await executeRoute(
      controllerRoute(new GetClearanceController(queries), { guards: 'skip' }),
      request(),
      {
        validateResponses: true,
      },
    );

    expect(response).toMatchObject({
      status: 200,
      body: { clearanceId: 'clearance-1', status: 'running', attempts: 1, done: 120, total: 450 },
    });

    expect(received).toMatchObject([PARAMS]);
  });

  it('answers the refusal of the use case with its code', async () => {
    const queries = new InMemoryQueryBus().register(GetClearanceQuery, {
      execute: async () => {
        throw UnknownClearance.forClearance('clearance-1');
      },
    });

    const response = await executeRoute(
      controllerRoute(new GetClearanceController(queries), { guards: 'skip' }),
      request(),
      {
        validateResponses: true,
      },
    );

    expect(response).toMatchObject({ body: { code: 'UNKNOWN_CLEARANCE' } });
  });
});

function request() {
  return { params: PARAMS, query: {}, headers: {}, body: {}, raw: undefined };
}
