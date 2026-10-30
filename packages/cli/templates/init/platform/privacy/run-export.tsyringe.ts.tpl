{{#if audit.on}}
import { AuditTrail, auditedPersonalDataExport, logLostRecords } from '@ddd-ts-kit/audit';
{{/if}}
import type { Application as Container } from '@ddd-ts-kit/di';
import {
  Clock,
  ExecutionScope,
{{#if audit.on}}
  IdGenerator,
  Logger,
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
import { dataSubjectExports } from '{{alias.platform}}/privacy/data-subject-exports{{alias.ext}}';

export interface ExportRequest {
  /** The composed application: the exports are resolved from it. */
  readonly container: Container;
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
 * `data-subject-exports.ts` keeps of the person{{#if tenancy.any}}, in every tenant{{/if}}, gathered into one dated document
 * of a stable format{{#if audit.on}}; every export writes its entry to the audit trail, the operator, the subject and
 * the number of records, never the values{{/if}}. A subject that is not an opaque identifier is refused
 * before anything is read.
 */
export function runExport(subject: string, request: ExportRequest): Promise<PersonalDataExportDocument> {
  const { container, operator, correlationId } = request;
  const scope = container.resolve(ExecutionScope);
  const clock = container.resolve(Clock);
  const context = executionContext({ correlationId, actor: operatorActor(operator), origin: 'cli' });
{{#if audit.on}}
  const trail = container.resolve(AuditTrail);
  const onLostRecord = logLostRecords(container.resolve(Logger));
  const source = { scope, clock, ids: container.resolve(IdGenerator), onLostRecord };
  const audited = (port: PersonalDataExport): PersonalDataExport => auditedPersonalDataExport(port, trail, source);
  const exports = dataSubjectExports.map((port) => audited(container.resolve(port)));
{{/if}}
{{#unless audit.on}}
  const exports: readonly PersonalDataExport[] = dataSubjectExports.map((port) => container.resolve(port));
{{/unless}}

  return scope.run(context, () =>
    exportDataSubject(subject, {
      exports,
      clock,
{{#if tenancy.any}}
      inEveryTenant: recordsInEachTenant(scope, request.tenants),
{{/if}}
    }),
  );
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
