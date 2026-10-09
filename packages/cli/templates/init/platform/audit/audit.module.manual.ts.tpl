import { requires, type UseCaseDeclaration } from '@ddd-ts-kit/auth';
import type { Route } from '@ddd-ts-kit/http';
import { traceUseCase } from '@ddd-ts-kit/tracing';
import type { Platform } from '../platform.module.js';
import { auditPermissions } from './audit.permissions.js';
import { ListAuditEntriesHandler } from './list-audit-entries.handler.js';
import { ListAuditEntriesQuery } from './list-audit-entries.query.js';
import { listAuditEntriesRoute } from './list-audit-entries.route.js';

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
export function wireAudit(platform: Platform): AuditWiring {
  platform.queries.register(ListAuditEntriesQuery, traceUseCase(new ListAuditEntriesHandler(platform.audit.trail), { context: 'audit' }));
  return {
    name: 'audit',
{{#if authz.rebac}}
    useCases: [requires(ListAuditEntriesQuery, auditPermissions['trail.read'], { resource: () => ({ type: 'context', id: 'audit' }) })],
{{/if}}
{{#unless authz.rebac}}
    useCases: [requires(ListAuditEntriesQuery, auditPermissions['trail.read'])],
{{/unless}}
    routes: [listAuditEntriesRoute(platform.queries)],
  };
}
