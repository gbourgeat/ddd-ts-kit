import { AuditReader, AuditTrail } from '@ddd-ts-kit/audit';
import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { subscribeAll } from '@ddd-ts-kit/events';
import { EventSubscribers } from '@ddd-ts-kit/kernel';
{{#if audit.route}}
import { auditPermissions } from '{{alias.platform}}/audit/audit.permissions{{alias.ext}}';
{{/if}}
import type { Audit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{#if audit.route}}
import { SearchAuditEntriesHandler } from '{{alias.platform}}/audit/search-audit-entries.handler{{alias.ext}}';
import { SearchAuditEntriesQuery } from '{{alias.platform}}/audit/search-audit-entries.query{{alias.ext}}';
{{/if}}

/**
 * The audit trail as a capability of the platform, not a bounded context: the store behind its
 * two ports, the subscription to every declared integration event, under a name of its own{{#if audit.route}}, and
 * its read side, one protected query registered like any use case so that reading the trail is
 * authorized and recorded{{/if}}.
 */
export function auditModule(audit: Audit): ContextModule {
  return defineContextModule({
    name: 'audit',
    register(builder) {
      builder.bind(AuditTrail).toValue(audit.trail);
      builder.bind(AuditReader).toValue(audit.trail);
{{#if audit.route}}
{{#if authz.rebac}}

      builder
        .query(SearchAuditEntriesQuery)
        .requires(auditPermissions['trail.read'], { resource: () => ({ type: 'context', id: 'audit' }) })
        .handledBy(SearchAuditEntriesHandler, [AuditReader]);
{{/if}}
{{#unless authz.rebac}}

      builder
        .query(SearchAuditEntriesQuery)
        .requires(auditPermissions['trail.read'])
        .handledBy(SearchAuditEntriesHandler, [AuditReader]);
{{/unless}}
{{/if}}
    },
    onStart({ resolve }) {
      subscribeAll(resolve(EventSubscribers).forContext(audit.consumer), audit.subscriptions);
    },
  });
}
