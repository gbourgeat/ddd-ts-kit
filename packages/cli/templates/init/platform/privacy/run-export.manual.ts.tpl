{{#if audit.on}}
import { auditedPersonalDataExport } from '@ddd-ts-kit/audit';
{{/if}}
import {
{{#if eventSourcing.on}}
  EventStorePersonalDataExport,
{{/if}}
  executionContext,
  exportDataSubject,
{{#if tenancy.any}}
  recordsInEachTenant,
{{/if}}
  type Actor,
  type PersonalDataExport,
  type PersonalDataExportDocument,
} from '@ddd-ts-kit/kernel';
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import { dataSubjectExports } from '{{alias.platform}}/privacy/data-subject-exports{{alias.ext}}';

export interface ExportRequest {
  /** The assembled platform: the scope, the clock{{#if audit.on}}, the trail{{/if}}{{#if eventSourcing.on}}, the event store{{/if}} and the exports come from it. */
  readonly platform: Platform;
  /** Who asks for the export, as typed: the actor of the work{{#if audit.on}}, named by the entry each export writes{{/if}}. */
  readonly operator: string;
  /** The correlation of the work: one per export. */
  readonly correlationId: string;
{{#if tenancy.any}}
  /** The tenants the deployment serves: the records are gathered in each one, in an execution context of that tenant, since a read of tenant data is confined to it. */
  readonly tenants: readonly string[];
{{/if}}
}

/**
 * The right of access and to portability of one data subject (GDPR articles 15 and 20), in an
 * execution context of its own (origin `cli`): every record each context declared in
 * `data-subject-exports.ts` keeps of the person{{#if eventSourcing.on}}, and every value the event store keeps sealed with the key of the person{{/if}}{{#if tenancy.any}}, in every tenant{{/if}}, gathered into one dated document
 * of a stable format{{#if audit.on}}; every export writes its entry to the audit trail, the operator, the subject and
 * the number of records, never the values{{/if}}. A subject that is not an opaque identifier is refused
 * before anything is read.
 */
export function runExport(subject: string, request: ExportRequest): Promise<PersonalDataExportDocument> {
  const { platform, operator, correlationId } = request;
  const context = executionContext({ correlationId, actor: operatorActor(operator), origin: 'cli' });
{{#if audit.on}}
  const { trail, onLostRecord } = platform.audit;
  const source = { scope: platform.scope, clock: platform.clock, ids: platform.ids, onLostRecord };
  const audited = (port: PersonalDataExport): PersonalDataExport => auditedPersonalDataExport(port, trail, source);
{{#if eventSourcing.on}}
  const exports = [...dataSubjectExports.map((exported) => exported(platform)), eventStoreExport(platform)].map(audited);
{{/if}}
{{#unless eventSourcing.on}}
  const exports = dataSubjectExports.map((exported) => audited(exported(platform)));
{{/unless}}
{{/if}}
{{#unless audit.on}}
{{#if eventSourcing.on}}
  const exports: readonly PersonalDataExport[] = [...dataSubjectExports.map((exported) => exported(platform)), eventStoreExport(platform)];
{{/if}}
{{#unless eventSourcing.on}}
  const exports: readonly PersonalDataExport[] = dataSubjectExports.map((exported) => exported(platform));
{{/unless}}
{{/unless}}

  return platform.scope.run(context, () =>
    exportDataSubject(subject, {
      exports,
      clock: platform.clock,
{{#if tenancy.any}}
      inEveryTenant: recordsInEachTenant(platform.scope, request.tenants),
{{/if}}
    }),
  );
}

{{#if eventSourcing.on}}
/** What the event store keeps of the person: every value sealed with their key, opened, under `platform.event-store.<event type>`. Empty once the key is destroyed. */
function eventStoreExport(platform: Platform): PersonalDataExport {
  const { events, subjectKeys } = platform.eventSourcing;

  return new EventStorePersonalDataExport({ name: 'platform.event-store', events, keys: subjectKeys, scope: platform.scope });
}

{{/if}}
function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
