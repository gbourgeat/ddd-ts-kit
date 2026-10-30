import {
  eraseDataSubject,
  executionContext,
  type Actor,
  type DataSubjectErasure,
  type DataSubjectErasureReport,
  type ExecutionContext,
  type ExecutionScope,
  type IdGenerator,
} from '@ddd-ts-kit/kernel';
import type { Audit } from '@/platform/audit/create-audit';
import type { PersonDirectoryContract } from '@/contexts/identity/published-language';

/** Why the operator reaches every network here, as the trail records it: a code, never a sentence. */
const PATIENT_ERASURE = 'PATIENT_ERASURE';

export interface CommandLineErasure {
  readonly scope: ExecutionScope;
  readonly ids: IdGenerator;
  /** Who runs the script, as typed: the access to the script is the credential. */
  readonly operator: string;
  /** Who is known to the platform: tells a run again from a mistyped id, once no key was destroyed and no copy erased. */
  readonly persons: PersonDirectoryContract;
  /** How the operator reaches the persons of every network, which the trail records before the lookup runs. */
  readonly elevate: Audit['elevate'];
  /** The networks the deployment serves (`NETWORKS`): each copy is erased in each one, in an execution context of that network. */
  readonly networks: readonly string[];
}

/**
 * An erasure run by `npm run privacy:erase`, in an execution context of its own (origin `cli`):
 * the operator who runs it is the actor of the entry the audited key store writes, so that the
 * proof of the erasure names a person, never the script. The key is destroyed whether identity
 * still knows the patient or not: the key comes first, the record after. The copies the contexts
 * keep of the person are then erased network by network, each in a context of that network,
 * since a write of tenant data is never widened. When no key was destroyed and no copy erased,
 * the id is looked up among the persons of every network, under an elevation the trail records,
 * so that a mistyped id is refused (`UnknownDataSubjectError`) and a run again rebuilds. The
 * context of the key names no network: the keys of the data subjects are outside the networks
 * (ADR-0004), and the entry goes to the global chain, which platform staff read. Give it the keys
 * of `createAudit`, so that the erasure is recorded.
 */
export function eraseOnTheCommandLine(
  patientId: string,
  parts: Pick<DataSubjectErasure, 'keys' | 'rebuilds' | 'copies' | 'shared'>,
  { scope, ids, operator, persons, elevate, networks }: CommandLineErasure,
): Promise<DataSubjectErasureReport> {
  const context = executionContext({ correlationId: ids.next(), actor: operatorActor(operator), origin: 'cli' });

  const isKnown = (subject: string): Promise<boolean> =>
    elevate({ reason: PATIENT_ERASURE, tenants: 'all' }, () => isKnownToIdentity(subject, persons));

  const inEveryTenant = (work: () => Promise<number>): Promise<number> =>
    sumOver(networks, (network) => scope.run(inNetwork(context, network), work));

  return scope.run(context, () => eraseDataSubject(patientId, { ...parts, isKnown, inEveryTenant }));
}

/** The same operator and correlation, in the network a copy is kept in. */
function inNetwork(context: ExecutionContext, network: string): ExecutionContext {
  return executionContext({ ...context, tenantId: network });
}

async function sumOver(networks: readonly string[], count: (network: string) => Promise<number>): Promise<number> {
  let total = 0;

  for (const network of networks) {
    total += await count(network);
  }

  return total;
}

async function isKnownToIdentity(patientId: string, persons: PersonDirectoryContract): Promise<boolean> {
  const known = await persons.byIds([patientId]);

  return known.length > 0;
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
