import { executionContext, type Actor, type ExecutionScope, type IdGenerator } from '@ddd-ts-kit/kernel';
import { eraseDataSubject, type ErasureParts, type ErasureReport } from '@/platform/events/erase-data-subject';

export interface CommandLineErasure {
  readonly scope: ExecutionScope;
  readonly ids: IdGenerator;
  /** Who runs the script, as typed: the access to the script is the credential. */
  readonly operator: string;
}

/**
 * An erasure run by `npm run erase:patient`, in an execution context of its own (origin `cli`):
 * the operator who runs it is the actor of the entry the audited key store writes, so that the
 * proof of the erasure names a person, never the script. The context names no network: the keys
 * of the data subjects are outside the networks (ADR-0004), and the entry goes to the global
 * chain, which platform staff read. Give it the keys of `createAudit`, so that the erasure is
 * recorded.
 */
export function eraseOnTheCommandLine(
  subject: string,
  parts: ErasureParts,
  { scope, ids, operator }: CommandLineErasure,
): Promise<ErasureReport> {
  const context = executionContext({ correlationId: ids.next(), actor: operatorActor(operator), origin: 'cli' });

  return scope.run(context, () => eraseDataSubject(subject, parts));
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
