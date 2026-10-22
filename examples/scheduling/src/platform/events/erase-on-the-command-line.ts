import type { AuditSource } from '@ddd-ts-kit/audit';
import { executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { eraseDataSubject, type ErasureParts, type ErasureReport } from '@/platform/events/erase-data-subject';

/**
 * An erasure run by `npm run erase:patient`, in an execution context of its own (origin `cli`):
 * the operator who runs it is the actor of the entry the audited key store writes, so that the
 * proof of the erasure names a person, never the script. Give it the keys of `createAudit`, so
 * that the erasure is recorded.
 */
export function eraseOnTheCommandLine(
  subject: string,
  parts: ErasureParts,
  caller: { readonly source: AuditSource; readonly operator: string },
): Promise<ErasureReport> {
  const { scope, ids } = caller.source;
  const actor = operatorActor(caller.operator);

  return scope.run(executionContext({ correlationId: ids.next(), actor, origin: 'cli' }), () =>
    eraseDataSubject(subject, parts),
  );
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
