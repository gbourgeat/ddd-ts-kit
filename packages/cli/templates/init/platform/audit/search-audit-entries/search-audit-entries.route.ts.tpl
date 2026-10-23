import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, pageRequestFrom, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { auditEntriesFilterOf } from '{{alias.platform}}/audit/search-audit-entries/audit-entries-filter-of{{alias.ext}}';
import { auditEntriesParameters, auditPageLimits } from '{{alias.platform}}/audit/search-audit-entries/audit-entries-parameters{{alias.ext}}';
import { auditEntrySchema } from '{{alias.platform}}/audit/search-audit-entries/audit-entry-view{{alias.ext}}';
import { auditEntryViewOf } from '{{alias.platform}}/audit/search-audit-entries/audit-entry-view-of{{alias.ext}}';
import { SearchAuditEntriesQuery } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.query{{alias.ext}}';

/** The audit trail as a protected read: a use case like any other, so reading it is authorized and recorded. */
export function searchAuditEntriesRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/audit/entries',
      operationId: 'searchAuditEntries',
      summary: 'Search the entries of the audit trail',
      tags: ['audit'],
      request: { query: auditEntriesParameters },
      responses: { 200: { description: 'A page of entries.', body: pageSchemaOf(auditEntrySchema) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: ['{{authn.scheme}}'],
    },
    async (input) => {
      const page = await queries.execute(
        new SearchAuditEntriesQuery(
          actorOf(input.context.principal),
          pageRequestFrom(input.query, auditPageLimits),
          auditEntriesFilterOf(input.query),
        ),
      );

      return { status: 200, body: pageResponse(page, auditEntryViewOf) };
    },
  );
}
