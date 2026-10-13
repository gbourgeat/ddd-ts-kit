import { stagedWrites } from './staged-writes.js';
import { unitOfWorkScope } from './unit-of-work-scope.js';

/**
 * For an adapter writing to a store that cannot join the transaction (Redis, a remote queue):
 * called inside a unit of work, `write` waits for the commit and never runs when it rolls back;
 * called anywhere else, it runs at once. What it risks is a crash between the commit and the
 * write: the write is then lost, so what must never be lost goes to a store the transaction
 * covers. A staged write that fails is handed to `failed`, the commit being done; without it, it
 * is dropped.
 */
export async function whenCommitted(
  write: () => Promise<void>,
  failed: (error: unknown) => void = ignored,
): Promise<void> {
  const scope = unitOfWorkScope.getStore();

  if (scope?.kind !== 'unit-of-work' || (scope.stage !== 'open' && scope.stage !== 'before-commit')) {
    await write();

    return;
  }

  const writes = stagedWrites.get(scope) ?? [];

  writes.push({ write, failed });
  stagedWrites.set(scope, writes);
}

function ignored(): void {
  return undefined;
}
