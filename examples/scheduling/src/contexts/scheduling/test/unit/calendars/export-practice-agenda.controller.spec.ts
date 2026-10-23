import { describe, expect, it } from 'vitest';
import { Representations, controllerRoute, executeRoute, type RouteResponse } from '@ddd-ts-kit/http';
import { InMemoryQueryBus, type Actor } from '@ddd-ts-kit/kernel';
import { SearchPracticeAgendaQuery } from '@/contexts/scheduling/calendars/application/queries/search-practice-agenda/search-practice-agenda.query';
import { ExportPracticeAgendaController } from '@/contexts/scheduling/calendars/presentation/http/practices/export-practice-agenda/export-practice-agenda.controller';
import { AgendaEntrySerializer } from '@/contexts/scheduling/presentation/http/shared/agenda-entry.serializer';
import { anAgendaEntry } from '@/contexts/scheduling/test/builders/agenda-entry.builder';

const caller: Actor = { id: 'manager-1', type: 'user', roles: [], attributes: {} };

const entries = [
  anAgendaEntry()
    .withMany({ id: 'appointment-1', startsAt: new Date('2026-03-02T09:00:00.000Z') })
    .build(),
  anAgendaEntry().withMany({ id: 'appointment-2', status: 'cancelled', cancelledBy: 'patient' }).build(),
];

describe('GET /practices/:practiceId/agenda/export', () => {
  const asked: SearchPracticeAgendaQuery[] = [];

  // One appointment per page: the export asks the next page with the cursor of the one before, through the bus.
  const queries = new InMemoryQueryBus().register(SearchPracticeAgendaQuery, {
    execute: async (query) => {
      asked.push(query);

      const page = query.criteria.pageRequest;
      const at = page?.kind === 'cursor' && page.cursor !== undefined ? Number(page.cursor) : 0;

      return { items: entries.slice(at, at + 1), ...(at + 1 < entries.length ? { nextCursor: String(at + 1) } : {}) };
    },
  });

  const route = controllerRoute(new ExportPracticeAgendaController(queries, new AgendaEntrySerializer()));

  const request = {
    params: { practiceId: 'practice-1' },
    query: {},
    headers: { accept: 'text/csv' },
    body: undefined,
    raw: undefined,
  };

  it('streams the agenda of the practice as CSV, one row per appointment, with the public fields', async () => {
    const response = await executeRoute(route, request, {
      representations: Representations.standard(),
      resolvePrincipal: () => caller,
    });

    const rows = (await text(response)).trimEnd().split('\r\n');

    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');

    expect(asked.map((query) => [query.practiceId, query.actor])).toEqual([
      ['practice-1', caller],
      ['practice-1', caller],
    ]);

    expect(rows[0]).toBe(
      'id,calendarId,practiceId,practitionerId,patientId,appointmentTypeId,startsAt,endsAt,day,status,confirmBefore,cancelledBy',
    );

    expect(rows.slice(1).map((row) => row.split(',')[0])).toEqual(['appointment-1', 'appointment-2']);
  });

  it('answers the same rows in XML to a partner who asks for it', async () => {
    const response = await executeRoute(
      route,
      { ...request, headers: { accept: 'application/xml' } },
      { representations: Representations.standard(), resolvePrincipal: () => caller },
    );

    expect(await text(response)).toContain('<item><id>appointment-1</id>');
  });

  it('refuses a practice that is not named', async () => {
    const response = await executeRoute(
      route,
      { ...request, params: { practiceId: '' } },
      { resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(422);
  });
});

async function text(response: RouteResponse): Promise<string> {
  let written = '';

  for await (const chunk of response.stream ?? []) {
    written += chunk;
  }

  return written;
}
