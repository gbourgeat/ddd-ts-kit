import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus, planCriteria, scoped } from '@ddd-ts-kit/kernel';
import { agendaCriteria } from '#src/contexts/scheduling/application/ports/agenda.port.js';
import { SearchPracticeAgendaQuery } from '#src/contexts/scheduling/application/queries/search-practice-agenda/search-practice-agenda.query.js';
import { searchPracticeAgendaRoute } from '#src/contexts/scheduling/presentation/http/search-practice-agenda.route.js';
import { anAgendaEntry } from '#src/contexts/scheduling/test/builders/agenda-entry.builder.js';

const requested = anAgendaEntry()
  .withMany({ id: 'appointment-1', status: 'requested', confirmBefore: new Date('2026-03-01T12:00:00.000Z') })
  .build();

const cancelled = anAgendaEntry()
  .withMany({ id: 'appointment-2', status: 'cancelled', cancelledBy: 'practice' })
  .build();

describe('GET /practices/:practiceId/agenda', () => {
  it('answers 200 with one page of public lines: instants in ISO 8601, neither the buffer nor the internal stamp', async () => {
    const queries = new InMemoryQueryBus().register(SearchPracticeAgendaQuery, {
      execute: async () => ({ items: [requested, cancelled], total: 2 }),
    });

    const response = await executeRoute(searchPracticeAgendaRoute(queries), request({}), { validateResponses: true });

    expect(response).toMatchObject({ status: 200, body: { total: 2 } });

    expect(response.body).toMatchObject({
      items: [
        {
          id: 'appointment-1',
          calendarId: 'calendar-1',
          practiceId: 'practice-1',
          practitionerId: 'practitioner-1',
          patientId: 'patient-1',
          appointmentTypeId: 'consultation',
          startsAt: '2026-03-02T09:00:00.000Z',
          endsAt: '2026-03-02T09:30:00.000Z',
          day: '2026-03-02',
          status: 'requested',
          confirmBefore: '2026-03-01T12:00:00.000Z',
        },
        { id: 'appointment-2', status: 'cancelled', cancelledBy: 'practice' },
      ],
    });

    expect(JSON.stringify(response.body)).not.toContain('heldUntil');
    expect(JSON.stringify(response.body)).not.toContain('changedAt');
  });

  it('hands the use case the filters, the sort and the page of the query string', async () => {
    const received: SearchPracticeAgendaQuery[] = [];

    const queries = new InMemoryQueryBus().register(SearchPracticeAgendaQuery, {
      execute: async (query) => {
        received.push(query);

        return { items: [], total: 0 };
      },
    });

    await executeRoute(
      searchPracticeAgendaRoute(queries),
      request({ 'filter[status]': 'in:booked,requested', 'filter[day]': '2026-03-02', sort: '-startsAt', limit: '5' }),
      { validateResponses: true },
    );

    const [query] = received;

    const plan =
      query === undefined ? undefined : planCriteria(agendaCriteria, scoped(query.criteria, { kind: 'all' }));

    expect(query).toMatchObject({ practiceId: 'practice-1' });
    expect(plan?.filter).toBeDefined();
    expect(plan?.sort[0]).toMatchObject({ field: 'startsAt', direction: 'desc' });
    expect(plan?.limit).toBe(5);
  });

  it.each([
    ['a filter on a field the agenda does not declare', { 'filter[colour]': 'red' }],
    ['an operator the field does not take', { 'filter[patientId]': 'contains:patient' }],
    ['a sort on a field that is not sortable', { sort: 'endsAt' }],
    ['a page larger than the agenda allows', { limit: '500' }],
    ['a start that is no instant', { 'filter[startsAt]': 'gte:tomorrow' }],
  ])('refuses %s with 422', async (_case, query) => {
    const queries = new InMemoryQueryBus().register(SearchPracticeAgendaQuery, {
      execute: async () => ({ items: [], total: 0 }),
    });

    const response = await executeRoute(searchPracticeAgendaRoute(queries), request(query), {
      validateResponses: true,
    });

    expect(response.status).toBe(422);
  });
});

function request(query: Record<string, string>) {
  return { params: { practiceId: 'practice-1' }, query, headers: {}, body: undefined, raw: undefined };
}
