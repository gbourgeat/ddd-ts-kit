import { dispatchAfterCommit } from './dispatch-after-commit.js';
import { dispatchBeforeCommit } from './dispatch-before-commit.js';
import { unitOfWorkScope, type UnitOfWorkScope } from './unit-of-work-scope.js';

/**
 * What every `UnitOfWork.run` is made of. `transaction` runs what it is given atomically: it
 * begins, calls it, and commits when it resolved or rolls back when it rejected.
 *
 * The domain events of the aggregates saved by `work` wait in the scope of this unit of work,
 * in recording order across the saves. Once `work` has returned they are dispatched, still
 * inside `transaction`: the handlers see every save, and what they save or append to the outbox
 * commits with the rest. A handler that fails, like `work` that fails, rejects the whole: the
 * transaction rolls back, the waiting events are dropped and never come back on the aggregates.
 * Once `transaction` has resolved, and only then, the `after-commit` handlers run.
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

  const scope: UnitOfWorkScope = { kind: 'unit-of-work', stage: 'open', queue: [], dispatched: [] };

  const result = await unitOfWorkScope
    .run(scope, () => transaction(() => thenDispatched(work, scope)))
    .finally(() => {
      scope.stage = 'closed';
      scope.queue.length = 0;
    });

  await dispatchAfterCommit(scope);

  return result;
}

function isRunning(scope: UnitOfWorkScope | undefined): boolean {
  return scope?.kind === 'unit-of-work' && (scope.stage === 'open' || scope.stage === 'before-commit');
}

async function thenDispatched<T>(work: () => Promise<T>, scope: UnitOfWorkScope): Promise<T> {
  const result = await work();

  await dispatchBeforeCommit(scope);

  return result;
}
