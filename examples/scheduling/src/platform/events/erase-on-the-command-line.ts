import { executionContext, type Actor, type ExecutionScope, type IdGenerator } from '@ddd-ts-kit/kernel';
import type { Audit } from '@/platform/audit/create-audit';
import { eraseDataSubject, type ErasureParts, type ErasureReport } from '@/platform/events/erase-data-subject';
import { UnknownPatientError } from '@/platform/events/unknown-patient-error';
import type { PersonDirectoryContract } from '@/contexts/identity/published-language/index';

/** Why the operator reaches every network here, as the trail records it: a code, never a sentence. */
const PATIENT_ERASURE = 'PATIENT_ERASURE';

export interface CommandLineErasure {
  readonly scope: ExecutionScope;
  readonly ids: IdGenerator;
  /** Who runs the script, as typed: the access to the script is the credential. */
  readonly operator: string;
  /** Who is known to the platform: an id that names nobody is refused before any key is touched. */
  readonly persons: PersonDirectoryContract;
  /** How the operator reaches the persons of every network, which the trail records before the lookup runs. */
  readonly elevate: Audit['elevate'];
}

/**
 * An erasure run by `npm run erase:patient`, in an execution context of its own (origin `cli`):
 * the operator who runs it is the actor of the entry the audited key store writes, so that the
 * proof of the erasure names a person, never the script. The patient has to be known: a person
 * belongs to one network and the script to none, so the lookup runs under an elevation over
 * every network, recorded in the trail, and an unknown id is refused (`UnknownPatientError`)
 * before anything is touched. The erasure itself runs outside the elevation and names no
 * network: the keys of the data subjects are outside the networks (ADR-0004), and the entry
 * goes to the global chain, which platform staff read. Give it the keys of `createAudit`, so
 * that the erasure is recorded.
 */
export function eraseOnTheCommandLine(
  patientId: string,
  parts: ErasureParts,
  { scope, ids, operator, persons, elevate }: CommandLineErasure,
): Promise<ErasureReport> {
  const context = executionContext({ correlationId: ids.next(), actor: operatorActor(operator), origin: 'cli' });

  return scope.run(context, async () => {
    await elevate({ reason: PATIENT_ERASURE, tenants: 'all' }, () => assertKnown(patientId, persons));

    return eraseDataSubject(patientId, parts);
  });
}

async function assertKnown(patientId: string, persons: PersonDirectoryContract): Promise<void> {
  const known = await persons.byIds([patientId]);

  if (known.length === 0) {
    throw new UnknownPatientError(patientId);
  }
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
