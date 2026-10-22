import { executionContext, type Actor, type ExecutionScope, type IdGenerator } from '@ddd-ts-kit/kernel';
import type { Audit } from '@/platform/audit/create-audit';
import { eraseDataSubject, type ErasureParts, type ErasureReport } from '@/platform/events/erase-data-subject';
import type { PersonDirectoryContract } from '@/contexts/identity/published-language/index';

/** Why the operator reaches every network here, as the trail records it: a code, never a sentence. */
const PATIENT_ERASURE = 'PATIENT_ERASURE';

export interface CommandLineErasure {
  readonly scope: ExecutionScope;
  readonly ids: IdGenerator;
  /** Who runs the script, as typed: the access to the script is the credential. */
  readonly operator: string;
  /** Who is known to the platform: tells a run again from a mistyped id, once no key was destroyed. */
  readonly persons: PersonDirectoryContract;
  /** How the operator reaches the persons of every network, which the trail records before the lookup runs. */
  readonly elevate: Audit['elevate'];
}

/**
 * An erasure run by `npm run erase:patient`, in an execution context of its own (origin `cli`):
 * the operator who runs it is the actor of the entry the audited key store writes, so that the
 * proof of the erasure names a person, never the script. The key is destroyed whether identity
 * still knows the patient or not: the key comes first, the record after. When no key was
 * destroyed, the id is looked up among the persons of every network, under an elevation the
 * trail records, so that a mistyped id is refused (`UnknownDataSubjectError`) and a run again
 * rebuilds. The context names no network: the keys of the data subjects are outside the
 * networks (ADR-0004), and the entry goes to the global chain, which platform staff read. Give
 * it the keys of `createAudit`, so that the erasure is recorded.
 */
export function eraseOnTheCommandLine(
  patientId: string,
  parts: Pick<ErasureParts, 'keys' | 'projections'>,
  { scope, ids, operator, persons, elevate }: CommandLineErasure,
): Promise<ErasureReport> {
  const context = executionContext({ correlationId: ids.next(), actor: operatorActor(operator), origin: 'cli' });

  const isKnown = (subject: string): Promise<boolean> =>
    elevate({ reason: PATIENT_ERASURE, tenants: 'all' }, () => isKnownToIdentity(subject, persons));

  return scope.run(context, () => eraseDataSubject(patientId, { ...parts, isKnown }));
}

async function isKnownToIdentity(patientId: string, persons: PersonDirectoryContract): Promise<boolean> {
  const known = await persons.byIds([patientId]);

  return known.length > 0;
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
