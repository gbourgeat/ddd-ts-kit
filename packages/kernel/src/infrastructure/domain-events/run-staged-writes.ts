import { stagedWrites } from './staged-writes.js';
import type { UnitOfWorkScope } from './unit-of-work-scope.js';

/** Runs what the unit of work staged, once it committed, in staging order. Never rejects. */
export async function runStagedWrites(scope: UnitOfWorkScope): Promise<void> {
  const writes = stagedWrites.get(scope) ?? [];

  stagedWrites.delete(scope);

  for (const { write, failed } of writes) {
    try {
      await write();
    } catch (error) {
      tell(failed, error);
    }
  }
}

function tell(failed: (error: unknown) => void, error: unknown): void {
  try {
    failed(error);
  } catch {
    return;
  }
}
