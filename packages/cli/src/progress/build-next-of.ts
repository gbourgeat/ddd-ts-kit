import type { StatusRow } from './progress';

const BUILD_STEP = /^7(\s|$)/;

/** What the build step says when the rows are all done. */
const BUILD_DONE = '7 build done: close step 7 in docs/architecture/plan.md (Next: done)';

/**
 * The next step, derived from the rows of the slices table while the plan sits at step 7, the
 * build: no skill of the build rewrites the `Next:` line of the plan after each row, so it says
 * what was next on the day the plan was made. Undefined at any other step, without rows, or when
 * the line of the plan is not at step 7: the line of the plan is then the answer.
 */
export function buildNextOf(plan: string | null, rows: readonly StatusRow[]): string | undefined {
  if (plan === null || !BUILD_STEP.test(plan) || rows.length === 0) {
    return undefined;
  }

  if (rows.every((row) => row.status === 'done')) {
    return BUILD_DONE;
  }

  const ready = rows.find((row) => row.status === 'todo' && row.ready === 'trunk');

  return ready === undefined
    ? '7 build - no row is ready on the trunk: the rows left are in progress or wait for a dependency'
    : `7 use-case - build the next row ready on the trunk, #${ready.id} ${ready.slice} (${ready.context}) (skill \`ddd-ts-kit:use-case\`)`;
}
