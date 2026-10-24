import {
  NotADataSubjectIdError,
  executionContext,
  isDataSubjectId,
  type Actor,
  type PersonalDataExport,
  type PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import { dataSubjectExports } from '{{alias.platform}}/privacy/data-subject-exports{{alias.ext}}';

export interface ExportRequest {
  /** The assembled platform: the scope and the exports come from it. */
  readonly platform: Platform;
  /** Who asks for the export, as typed: the actor of the work. */
  readonly operator: string;
  /** The correlation of the work: one per export. */
  readonly correlationId: string;
{{#if tenancy.any}}
  /** The tenants the deployment serves: the records are gathered in each one, in an execution context of that tenant. */
  readonly tenants: readonly string[];
{{/if}}
}

/**
 * The right of access and to portability of one data subject: every record each context declared in
 * `data-subject-exports.ts` keeps of the person{{#if tenancy.any}}, in every tenant{{/if}}, as plain data. A subject that is
 * not an opaque identifier is refused before anything is read.
 */
export async function runExport(subject: string, request: ExportRequest): Promise<PersonalDataRecord[]> {
  if (!isDataSubjectId(subject)) {
    throw new NotADataSubjectIdError();
  }

  const { platform, operator, correlationId } = request;
  const { scope } = platform;
  const context = executionContext({ correlationId, actor: operatorActor(operator), origin: 'cli' });
  const ports = dataSubjectExports.map((exported) => exported(platform));
{{#if tenancy.any}}
  const records: PersonalDataRecord[] = [];

  for (const tenantId of request.tenants) {
    records.push(...(await scope.run(executionContext({ ...context, tenantId }), () => recordsOf(subject, ports))));
  }

  return records;
{{/if}}
{{#unless tenancy.any}}

  return scope.run(context, () => recordsOf(subject, ports));
{{/unless}}
}

async function recordsOf(subject: string, ports: readonly PersonalDataExport[]): Promise<PersonalDataRecord[]> {
  const records: PersonalDataRecord[] = [];

  for (const port of ports) {
    records.push(...(await port.exportOf(subject)));
  }

  return records;
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
