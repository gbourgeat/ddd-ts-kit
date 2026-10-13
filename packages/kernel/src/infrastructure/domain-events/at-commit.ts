import type { CommitStep } from './commit-step.js';
import { unitOfWorkScope } from './unit-of-work-scope.js';

/**
 * Runs `step.apply` as the last step of the unit of work in progress: after its work and its
 * `before-commit` handlers, inside the transaction, just before the commit. A step that rejects
 * rolls the whole back, so nothing commits that the effect did not reach. When the transaction
 * rolls back after it applied (a later step, the commit itself), its `undo` runs, newest step
 * first. Outside of any unit of work, `apply` runs at once. For an effect a committed row relies
 * on, such as moving a staged file to the key the row records.
 */
export async function atCommit(step: CommitStep): Promise<void> {
  const scope = unitOfWorkScope.getStore();
  const open = scope?.kind === 'unit-of-work' && (scope.stage === 'open' || scope.stage === 'before-commit');

  if (open && scope.atCommit !== undefined) {
    scope.atCommit.push(step);

    return;
  }

  await step.apply();
}
