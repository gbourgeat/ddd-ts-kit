import { TransactionConflictError } from '../../domain/errors/transaction-conflict-error';
import { isTransactionConflict } from '../persistence/is-transaction-conflict';
import { isTransactionTimeout } from '../persistence/is-transaction-timeout';
import { TransactionTimeoutError } from '../persistence/transaction-timeout-error';
import { dispatchAfterCommit } from './dispatch-after-commit';
import { dispatchBeforeCommit } from './dispatch-before-commit';
import type { CommitStep } from './commit-step';
import { unitOfWorkScope, type UnitOfWorkScope } from './unit-of-work-scope';

/**
 * What every `UnitOfWork.run` is made of. `transaction` runs what it is given atomically: it
 * begins, calls it, and commits when it resolved or rolls back when it rejected.
 *
 * The domain events of the aggregates saved by `work` wait in the scope of this unit of work,
 * in recording order across the saves. Once `work` has returned they are dispatched, still
 * inside `transaction`: the handlers see every save, and what they save or append to the outbox
 * commits with the rest. A handler that fails, like `work` that fails, rejects the whole: the
 * transaction rolls back, the waiting events are dropped and never come back on the aggregates.
 * The steps handed to `atCommit` are applied last, still inside `transaction`; when it rejects,
 * those applied are undone. Once `transaction` has resolved, and only then, the `after-commit`
 * handlers run, then the work handed to `afterCommit`.
 *
 * A deadlock or a serialization failure the database raised anywhere in the transaction, on the
 * statement it chose, rejects the outermost unit of work as a `TransactionConflictError`, a
 * `ConcurrencyError` whose `cause` is the error of the driver: the caller runs it again. A
 * transaction its ORM could not start in time, the pool being busy, or ended for running too
 * long rejects it as a `TransactionTimeoutError` (`SERVICE_UNAVAILABLE`), the same way.
 *
 * Called inside a unit of work already running on the same asynchronous call chain it joins it:
 * `transaction(work)` and nothing else, so one dispatch, at the end of the outermost. Two
 * concurrent calls never share a scope.
 */
export async function withinUnitOfWork<T>(
  work: () => Promise<T>,
  transaction: (work: () => Promise<T>) => Promise<T>,
): Promise<T> {
  if (isRunning(unitOfWorkScope.getStore())) {
    return transaction(work);
  }

  const scope = openScope();
  const applied: CommitStep[] = [];

  const result = await unitOfWorkScope
    .run(scope, () => transaction(() => thenDispatched(work, scope, applied)))
    .catch(async (error: unknown) => {
      await undone(applied);
      throw translated(error);
    })
    .finally(() => {
      scope.stage = 'closed';
      scope.queue.length = 0;
    });

  await afterTheCommit(scope);

  return result;
}

/** What the database said of the transaction, in the words of the kernel; any other failure as it is. */
function translated(error: unknown): unknown {
  if (isTransactionConflict(error)) {
    return new TransactionConflictError(error);
  }

  return isTransactionTimeout(error) ? new TransactionTimeoutError(error) : error;
}

function isRunning(scope: UnitOfWorkScope | undefined): boolean {
  return scope?.kind === 'unit-of-work' && (scope.stage === 'open' || scope.stage === 'before-commit');
}

function openScope(): UnitOfWorkScope {
  return { kind: 'unit-of-work', stage: 'open', queue: [], dispatched: [], committed: [], atCommit: [] };
}

async function thenDispatched<T>(work: () => Promise<T>, scope: UnitOfWorkScope, applied: CommitStep[]): Promise<T> {
  const result = await work();

  await dispatchBeforeCommit(scope);

  for (const step of scope.atCommit ?? []) {
    await step.apply();
    applied.push(step);
  }

  return result;
}

/** Newest first; an undo that fails reported itself, and the others still run. */
async function undone(applied: readonly CommitStep[]): Promise<void> {
  for (const step of [...applied].reverse()) {
    await step.undo().catch(() => undefined);
  }
}

/** The `after-commit` handlers, then the work handed to `afterCommit`; a rejection is dropped, the work reported its own. */
async function afterTheCommit(scope: UnitOfWorkScope): Promise<void> {
  await dispatchAfterCommit(scope);

  for (const work of scope.committed ?? []) {
    await work().catch(() => undefined);
  }
}
