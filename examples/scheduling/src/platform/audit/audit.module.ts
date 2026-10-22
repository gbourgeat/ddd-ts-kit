import { AuditReader, AuditTrail } from '@ddd-ts-kit/audit';
import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { subscribeAll } from '@ddd-ts-kit/events';
import { EventSubscribers, SubjectKeyStore } from '@ddd-ts-kit/kernel';
import { auditPermissions } from '@/platform/audit/audit.permissions';
import type { Audit } from '@/platform/audit/create-audit';
import { SearchAuditEntriesHandler } from '@/platform/audit/search-audit-entries/search-audit-entries.handler';
import { SearchAuditEntriesQuery } from '@/platform/audit/search-audit-entries/search-audit-entries.query';

/**
 * The audit trail as a capability of the platform, not a bounded context: the store behind its
 * two ports, the subscription to every declared integration event, under a name of its own, the
 * key store of the data subjects in place of the one of the platform, so that an erasure from a
 * use case is recorded too, and its read side, one protected query registered like any use case
 * so that reading the trail is authorized and recorded.
 */
export function auditModule(audit: Audit): ContextModule {
  return defineContextModule({
    name: 'audit',
    register(builder) {
      builder.bind(AuditTrail).toValue(audit.trail);
      builder.bind(AuditReader).toValue(audit.reader);
      builder.rebind(SubjectKeyStore).toValue(audit.subjectKeys);

      builder
        .query(SearchAuditEntriesQuery)
        .requires(auditPermissions['trail.read'], { resource: () => ({ type: 'context', id: 'audit' }) })
        .handledByFactory((resolve) => new SearchAuditEntriesHandler(resolve(AuditReader), audit.elevate));
    },
    onStart({ resolve }) {
      subscribeAll(resolve(EventSubscribers).forContext(audit.consumer), audit.subscriptions);
    },
  });
}
