import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus, planCriteria, scoped } from '@ddd-ts-kit/kernel';
import {
  attendanceHistoryCriteria,
  type AttendanceEntry,
} from '@/contexts/scheduling/application/ports/attendance-history.port';
import { SearchAttendanceHistoryQuery } from '@/contexts/scheduling/application/queries/search-attendance-history/search-attendance-history.query';
import { SearchAttendanceHistoryController } from '@/contexts/scheduling/presentation/http/practices/search-attendance-history/search-attendance-history.controller';

const at = new Date('2026-03-02T09:00:00.000Z');

const opened: AttendanceEntry = {
  id: 'r#1',
  recordId: 'r',
  version: 1,
  fact: 'opened',
  appointmentId: null,
  startsAt: null,
  reason: null,
  notedAt: at,
};

const cancelled: AttendanceEntry = {
  ...opened,
  id: 'r#2',
  version: 2,
  fact: 'cancellation',
  appointmentId: 'a-1',
  startsAt: at,
  reason: 'Flu',
};

describe('GET /practices/:practiceId/patients/:patientId/attendance', () => {
  it('answers 200 with one page of the history: instants in ISO 8601, absent fields left out', async () => {
    const queries = new InMemoryQueryBus().register(SearchAttendanceHistoryQuery, {
      execute: async () => ({
        items: [opened, cancelled],
        total: 2,
      }),
    });

    const response = await executeRoute(
      controllerRoute(new SearchAttendanceHistoryController(queries), { guards: 'skip' }),
      request({}),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 200, body: { total: 2 } });

    expect(response.body).toMatchObject({
      items: [
        { version: 1, fact: 'opened', notedAt: '2026-03-02T09:00:00.000Z' },
        { version: 2, fact: 'cancellation', appointmentId: 'a-1', startsAt: '2026-03-02T09:00:00.000Z', reason: 'Flu' },
      ],
    });

    expect(JSON.stringify(response.body)).not.toContain('recordId');
  });

  it('hands the use case the practice, the patient, the filters, the sort and the page', async () => {
    const received: SearchAttendanceHistoryQuery[] = [];

    const queries = new InMemoryQueryBus().register(SearchAttendanceHistoryQuery, {
      execute: async (query) => {
        received.push(query);

        return { items: [], total: 0 };
      },
    });

    await executeRoute(
      controllerRoute(new SearchAttendanceHistoryController(queries), { guards: 'skip' }),
      request({ 'filter[fact]': 'no-show', sort: '-version', limit: '5' }),
      { validateResponses: true },
    );

    const [query] = received;

    const plan =
      query === undefined
        ? undefined
        : planCriteria(attendanceHistoryCriteria, scoped(query.criteria, { kind: 'all' }));

    expect(query).toMatchObject({ practiceId: 'practice-1', patientId: 'patient-1' });
    expect(plan?.sort[0]).toMatchObject({ field: 'version', direction: 'desc' });
    expect(plan?.limit).toBe(5);
  });

  it('refuses a filter on a field the history does not declare with 422', async () => {
    const queries = new InMemoryQueryBus().register(SearchAttendanceHistoryQuery, {
      execute: async () => ({ items: [], total: 0 }),
    });

    const response = await executeRoute(
      controllerRoute(new SearchAttendanceHistoryController(queries), { guards: 'skip' }),
      request({ 'filter[colour]': 'red' }),
      { validateResponses: true },
    );

    expect(response.status).toBe(422);
  });
});

function request(query: Record<string, string>) {
  return {
    params: { practiceId: 'practice-1', patientId: 'patient-1' },
    query,
    headers: {},
    body: undefined,
    raw: undefined,
  };
}
