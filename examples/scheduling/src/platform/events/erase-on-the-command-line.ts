import type { AuditSource } from '@ddd-ts-kit/audit';
import { executionContext, systemActor, type Actor } from '@ddd-ts-kit/kernel';
import { eraseDataSubject, type ErasureParts, type ErasureReport } from '@/platform/events/erase-data-subject';

/** The actor of an erasure run with no operator named. */
const SCRIPT = systemActor('erase-patient');

/**
 * An erasure run by `npm run erase:patient`, in an execution context of its own (origin `cli`):
 * the operator named is the actor of the entry the audited key store writes, and the script
 * itself when none is. Give it the keys of `createAudit`, so that the erasure is recorded.
 */
export function eraseOnTheCommandLine(
  subject: string,
  parts: ErasureParts,
  caller: { readonly source: AuditSource; readonly operator?: string },
): Promise<ErasureReport> {
  const { scope, ids } = caller.source;
  const actor = caller.operator === undefined ? SCRIPT : operatorActor(caller.operator);

  return scope.run(executionContext({ correlationId: ids.next(), actor, origin: 'cli' }), () =>
    eraseDataSubject(subject, parts),
  );
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
