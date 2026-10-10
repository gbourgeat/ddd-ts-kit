import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { SearchOccupancyQuery } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.query.js';
import { searchOccupancyRoute } from '@/contexts/analytics/presentation/http/search-occupancy.route.js';
import { anOccupancy } from '@/contexts/analytics/test/builders/occupancy.builder.js';

const line = anOccupancy({ heldMinutes: 30, appointmentsHeld: 1 });

describe('GET /practices/:practiceId/occupancy', () => {
  it('answers 200 when the use case succeeds', async () => {
    const { queries } = arrange();

    const response = await executeRoute(searchOccupancyRoute(queries), requestOf({}), { validateResponses: true });

    expect(response.status).toBe(200);
  });

  it('answers each line without the practice, which the path already names', async () => {
    const { queries } = arrange();

    const response = await executeRoute(searchOccupancyRoute(queries), requestOf({}), { validateResponses: true });

    expect(response.body).toEqual({
      items: [
        {
          id: 'calendar-1.2026-10-12',
          calendarId: 'calendar-1',
          day: '2026-10-12',
          heldMinutes: 30,
          appointmentsHeld: 1,
          completed: 0,
          noShows: 0,
          cancelledByPatient: 0,
          cancelledByPractice: 0,
        },
      ],
      total: 1,
    });
  });

  it('asks for the practice of the path, with the calendar, the range of days, the order and the page of the query', async () => {
    const { queries, asked } = arrange();

    const query = {
      'filter[calendarId]': 'calendar-1',
      'filter[day]': 'between:2026-10-12,2026-10-18',
      sort: '-day',
      limit: '7',
    };

    await executeRoute(searchOccupancyRoute(queries), requestOf(query), { validateResponses: true });

    expect(asked[0]?.practiceId).toBe('practice-1');

    expect(asked[0]?.criteria.filters).toEqual([
      { kind: 'condition', field: 'calendarId', operator: 'eq', value: 'calendar-1' },
      { kind: 'condition', field: 'day', operator: 'between', value: ['2026-10-12', '2026-10-18'] },
    ]);

    expect(asked[0]?.criteria.sort).toEqual([{ field: 'day', direction: 'desc' }]);
    expect(asked[0]?.criteria.pageRequest).toMatchObject({ limit: 7 });
  });

  it.each([
    { 'filter[noShows]': 'gte:1' },
    { 'filter[day]': 'contains:2026' },
    { sort: 'completed' },
    { limit: '1000' },
  ])('refuses %o, which the occupancy cannot be read by, with 422', async (query) => {
    const { queries } = arrange();

    const response = await executeRoute(searchOccupancyRoute(queries), requestOf(query), { validateResponses: true });

    expect(response.status).toBe(422);
  });
});

function requestOf(query: Readonly<Record<string, string>>) {
  return { params: { practiceId: 'practice-1' }, query, headers: {}, body: {}, raw: undefined };
}

function arrange() {
  const asked: SearchOccupancyQuery[] = [];

  const queries = new InMemoryQueryBus().register(SearchOccupancyQuery, {
    execute: async (query) => {
      asked.push(query);

      return { items: [line], total: 1 };
    },
  });

  return { queries, asked };
}
