import { afterCommit } from './after-commit';
import { unitOfWorkScope } from './unit-of-work-scope';

/**
 * For an adapter writing to a store that cannot join the transaction (Redis, a remote queue):
 * called inside a unit of work, `write` waits for the commit (`afterCommit`) and never runs when
 * it rolls back; called anywhere else, it runs at once and a failure rejects. What it risks is a
 * crash between the commit and the write: the write is then lost, so what must never be lost
 * goes to a store the transaction covers. A write that fails after the commit is handed to
 * `failed`; without it, it is dropped.
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

  await afterCommit(() => write().catch((error: unknown) => tell(failed, error)));
}

function tell(failed: (error: unknown) => void, error: unknown): void {
  try {
    failed(error);
  } catch {
    return;
  }
}

function ignored(): void {
  return undefined;
}
