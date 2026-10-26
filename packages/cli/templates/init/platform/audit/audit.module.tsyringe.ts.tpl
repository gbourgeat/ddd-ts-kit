{{#if audit.archive}}
import { ArchiveAuditEntries, AuditReader, AuditTrail } from '@ddd-ts-kit/audit';
{{/if}}
{{#unless audit.archive}}
import { AuditReader, AuditTrail } from '@ddd-ts-kit/audit';
{{/unless}}
import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { subscribeAll } from '@ddd-ts-kit/events';
{{#if audit.archive}}
import { Clock, EventSubscribers, FileStorage } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless audit.archive}}
import { EventSubscribers } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if audit.route}}
import { auditPermissions } from '{{alias.platform}}/audit/audit.permissions{{alias.ext}}';
{{/if}}
import type { Audit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{#if audit.route}}
import { SearchAuditEntriesHandler } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.handler{{alias.ext}}';
import { SearchAuditEntriesQuery } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.query{{alias.ext}}';
{{/if}}

/**
 * The audit trail as a capability of the platform, not a bounded context: the store behind its
 * two ports, the subscription to every declared integration event, under a name of its own{{#if audit.route}}, and
 * its read side, one protected query registered like any use case so that reading the trail is
 * authorized and recorded{{/if}}{{#if audit.archive}}; and on the first day of every month at 04:00 UTC,
 * the entries older than the twelve whole months kept online moved to the storage of files,
 * verified and anchored (`audit.archive`){{/if}}.
 */
{{#if audit.archive}}
export function auditModule(audit: Audit, { jobs = true }: { readonly jobs?: boolean } = {}): ContextModule {
{{/if}}
{{#unless audit.archive}}
export function auditModule(audit: Audit): ContextModule {
{{/unless}}
  return defineContextModule({
    name: 'audit',
    register(builder) {
      builder.bind(AuditTrail).toValue(audit.trail);
{{#if tenancy.any}}
      builder.bind(AuditReader).toValue(audit.reader);
{{/if}}
{{#unless tenancy.any}}
      builder.bind(AuditReader).toValue(audit.trail);
{{/unless}}
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
{{#if audit.archive}}

      // Registered by the process that runs the jobs of the platform; a service of the deployment passes `jobs: false`.
      if (jobs) {
        builder
          .job('audit.archive', { cron: '0 4 1 * *' })
          .handledByFactory((resolve) => new ArchiveAuditEntries(audit.trail, resolve(FileStorage), resolve(Clock)));
      }
{{/if}}
    },
    onStart({ resolve }) {
      subscribeAll(resolve(EventSubscribers).forContext(audit.consumer), audit.subscriptions);
    },
  });
}
