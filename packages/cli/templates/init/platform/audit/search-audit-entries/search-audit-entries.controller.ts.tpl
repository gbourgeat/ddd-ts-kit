import {
  Authenticated,
  Controller,
  pageRequestFrom,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { auditEntriesFilterOf } from '{{alias.platform}}/audit/search-audit-entries/audit-entries-filter-of{{alias.ext}}';
import {
  auditEntriesParameters,
  auditPageLimits,
  type AuditEntriesParameters,
} from '{{alias.platform}}/audit/search-audit-entries/audit-entries-parameters{{alias.ext}}';
import { auditEntrySchema, type AuditEntryView } from '{{alias.platform}}/audit/search-audit-entries/audit-entry-view{{alias.ext}}';
import { auditEntryViewOf } from '{{alias.platform}}/audit/search-audit-entries/audit-entry-view-of{{alias.ext}}';
import { SearchAuditEntriesQuery } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.query{{alias.ext}}';

/** The audit trail as a protected read: a use case like any other, so reading it is authorized and recorded. */
@Controller({
  method: 'GET',
  path: '/audit/entries',
  summary: 'Search the entries of the audit trail',
  tags: ['audit'],
  guards: [Authenticated],
  query: auditEntriesParameters,
  response: { status: 200, description: 'A page of entries.', body: pageSchemaOf(auditEntrySchema) },
  errors: ['FORBIDDEN'],
})
export class SearchAuditEntriesController {
  constructor(private readonly queries: QueryBus) {}

  async handle({ query, actor }: HttpRequest<{ query: AuditEntriesParameters }>): Promise<PageBody<AuditEntryView>> {
    const page = await this.queries.execute(
      new SearchAuditEntriesQuery(actor, pageRequestFrom(query, auditPageLimits), auditEntriesFilterOf(query)),
    );

    return pageResponse(page, auditEntryViewOf);
  }
}
