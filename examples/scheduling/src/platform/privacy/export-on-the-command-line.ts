import { auditedPersonalDataExport } from '@ddd-ts-kit/audit';
import {
  executionContext,
  exportDataSubject,
  type Actor,
  type Clock,
  type ExecutionContext,
  type ExecutionScope,
  type IdGenerator,
  type PersonalDataExport,
  type PersonalDataExportDocument,
  type PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import type { Audit } from '@/platform/audit/create-audit';
import type { PersonDirectoryContract } from '@/contexts/identity/published-language';

/** Why the operator reaches every network here, as the trail records it: a code, never a sentence. */
const PATIENT_EXPORT = 'PATIENT_EXPORT';

export interface CommandLineExport {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Who runs the script, as typed: the access to the script is the credential. */
  readonly operator: string;
  /** Who is known to the platform: an id nobody knows is refused rather than answered with an empty document. */
  readonly persons: PersonDirectoryContract;
  /** The trail every handover is written to, and the elevation the lookup of an unknown id runs under. */
  readonly audit: Pick<Audit, 'trail' | 'elevate'>;
  /** The networks the deployment serves (`NETWORKS`): each export reads each one, in an execution context of that network. */
  readonly networks: readonly string[];
}

/**
 * An export run by `npm run privacy:export`, in an execution context of its own (origin `cli`):
 * the right of access and to portability of one person (GDPR articles 15 and 20). Each export of a
 * context is wrapped by `auditedPersonalDataExport`, so that every handover leaves an entry naming
 * the operator, the person and how many records were read, never the values; it reads network by
 * network, each in a context of that network. An id that no export answers and that no network
 * knows is refused (`UnknownDataSubjectError`): an empty document would state that nothing is kept.
 */
export function exportOnTheCommandLine(
  patientId: string,
  exports: readonly PersonalDataExport[],
  { scope, clock, ids, operator, persons, audit, networks }: CommandLineExport,
): Promise<PersonalDataExportDocument> {
  const context = executionContext({ correlationId: ids.next(), actor: operatorActor(operator), origin: 'cli' });
  const audited = exports.map((port) => auditedPersonalDataExport(port, audit.trail, { scope, clock, ids }));

  const isKnown = (subject: string): Promise<boolean> =>
    audit.elevate({ reason: PATIENT_EXPORT, tenants: 'all' }, async () => (await persons.byIds([subject])).length > 0);

  const inEveryTenant = (work: () => Promise<readonly PersonalDataRecord[]>): Promise<readonly PersonalDataRecord[]> =>
    gatherOver(networks, (network) => scope.run(inNetwork(context, network), work));

  return scope.run(context, () => exportDataSubject(patientId, { exports: audited, clock, isKnown, inEveryTenant }));
}

/** The same operator and correlation, in the network an export reads. */
function inNetwork(context: ExecutionContext, network: string): ExecutionContext {
  return executionContext({ ...context, tenantId: network });
}

async function gatherOver(
  networks: readonly string[],
  read: (network: string) => Promise<readonly PersonalDataRecord[]>,
): Promise<PersonalDataRecord[]> {
  const records: PersonalDataRecord[] = [];

  for (const network of networks) {
    records.push(...(await read(network)));
  }

  return records;
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
