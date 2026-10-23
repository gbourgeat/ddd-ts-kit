import {
  Controller,
  pageRequestFrom,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { AuditRoutes } from '@/platform/audit/audit.routes';
import { auditEntriesFilterOf } from '@/platform/audit/search-audit-entries/audit-entries-filter-of';
import {
  auditEntriesParameters,
  auditPageLimits,
  type AuditEntriesParameters,
} from '@/platform/audit/search-audit-entries/audit-entries-parameters';
import { auditEntrySchema, type AuditEntryView } from '@/platform/audit/search-audit-entries/audit-entry-view';
import { auditEntryViewOf } from '@/platform/audit/search-audit-entries/audit-entry-view-of';
import { SearchAuditEntriesQuery } from '@/platform/audit/search-audit-entries/search-audit-entries.query';

/** The audit trail as a protected read: a use case like any other, so reading it is authorized and recorded. */
@Controller({
  group: AuditRoutes,
  method: 'GET',
  path: '/entries',
  summary: 'Search the entries of the audit trail',
  query: auditEntriesParameters,
  response: { status: 200, description: 'A page of entries.', body: pageSchemaOf(auditEntrySchema) },
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
