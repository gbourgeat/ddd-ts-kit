import { requires, type UseCaseDeclaration } from '@ddd-ts-kit/auth';
import type { Route } from '@ddd-ts-kit/http';
import type { Platform } from '../platform.js';
import { auditPermissions } from './audit.permissions.js';
import { SearchAuditEntriesHandler } from './search-audit-entries.handler.js';
import { SearchAuditEntriesQuery } from './search-audit-entries.query.js';
import { searchAuditEntriesRoute } from './search-audit-entries.route.js';

interface AuditWiring {
  readonly name: string;
  readonly useCases: readonly UseCaseDeclaration[];
  readonly routes: readonly Route[];
}

/**
 * The read side of the audit trail: a capability of the platform, not a bounded context. It has
 * no model of its own, only one protected query over the `AuditReader` port, registered like any
 * use case so that reading the trail is authorized and recorded.
 */
export function auditModule(platform: Platform): AuditWiring {
  platform.queries.register(SearchAuditEntriesQuery, new SearchAuditEntriesHandler(platform.audit.trail), {
    context: 'audit',
  });

  return {
    name: 'audit',
    {{#if authz.rebac}}
    useCases: [
      requires(SearchAuditEntriesQuery, auditPermissions['trail.read'], {
        resource: () => ({ type: 'context', id: 'audit' }),
      }),
    ],
    {{/if}}
    {{#unless authz.rebac}}
    useCases: [requires(SearchAuditEntriesQuery, auditPermissions['trail.read'])],
    {{/unless}}
    routes: [searchAuditEntriesRoute(platform.queries)],
  };
}
