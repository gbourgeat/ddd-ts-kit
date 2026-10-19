import { requires, type UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{#if audit.controller}}
import { controllerRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
{{#if audit.functionRoute}}
import type { Route } from '@ddd-ts-kit/http';
{{/if}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import { auditPermissions } from '{{alias.platform}}/audit/audit.permissions{{alias.ext}}';
import { SearchAuditEntriesHandler } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.handler{{alias.ext}}';
import { SearchAuditEntriesQuery } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.query{{alias.ext}}';
{{#if audit.functionRoute}}
import { searchAuditEntriesRoute } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.route{{alias.ext}}';
{{/if}}
{{#if audit.controller}}
import { SearchAuditEntriesController } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.controller{{alias.ext}}';
import { securitySchemes } from '{{alias.platform}}/auth/authentication/security-schemes{{alias.ext}}';
{{/if}}

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
{{#if tenancy.any}}
  platform.queries.register(SearchAuditEntriesQuery, new SearchAuditEntriesHandler(platform.audit.reader), {
{{/if}}
{{#unless tenancy.any}}
  platform.queries.register(SearchAuditEntriesQuery, new SearchAuditEntriesHandler(platform.audit.trail), {
{{/unless}}
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
{{#if audit.functionRoute}}
    routes: [searchAuditEntriesRoute(platform.queries)],
{{/if}}
{{#if audit.controller}}
    routes: controllerRoutes([new SearchAuditEntriesController(platform.queries)], {
      security: Object.keys(securitySchemes),
    }),
{{/if}}
  };
}
