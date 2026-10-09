import type { AuditReader } from '@ddd-ts-kit/audit';
import { QUERY_BUS, defineContextModule, token, type ContextModule } from '@ddd-ts-kit/di';
import type { Route } from '@ddd-ts-kit/http';
import { auditPermissions } from './audit.permissions.js';
import { ListAuditEntriesHandler } from './list-audit-entries.handler.js';
import { ListAuditEntriesQuery } from './list-audit-entries.query.js';
import { listAuditEntriesRoute } from './list-audit-entries.route.js';

export const AUDIT_ROUTES = token<readonly Route[]>('audit.routes');
const AUDIT_READER = token<AuditReader>('audit.AuditReader');

/**
 * The read side of the audit trail: a capability of the platform, not a bounded context. It has
 * no model of its own, only one protected query over the `AuditReader` port, registered like any
 * use case so that reading the trail is authorized and recorded.
 */
export function auditModule(reader: AuditReader): ContextModule {
  return defineContextModule({
    name: 'audit',
    register(builder) {
      builder.bind(AUDIT_READER).toValue(reader);
{{#if authz.rebac}}
      builder
        .query(ListAuditEntriesQuery)
        .requires(auditPermissions['trail.read'], { resource: () => ({ type: 'context', id: 'audit' }) })
        .handledBy(ListAuditEntriesHandler, [AUDIT_READER]);
{{/if}}
{{#unless authz.rebac}}
      builder.query(ListAuditEntriesQuery).requires(auditPermissions['trail.read']).handledBy(ListAuditEntriesHandler, [AUDIT_READER]);
{{/unless}}
      builder.bind(AUDIT_ROUTES).toFactory((resolve) => [listAuditEntriesRoute(resolve(QUERY_BUS))]);
    },
  });
}
