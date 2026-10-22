import type { LockedTest } from './acceptance-lock';
import type { Drift, Judged } from './drift';
import type { RegressionSpec } from './regression-spec';

/** What a locked test became: its new fingerprint, or `removed`. */
const REMOVED = 'removed';

/**
 * The regression tests of a fix against its lock. A new test only needs locking again; a locked
 * test changed or removed needs a verdict of the acceptance-judge agent first, the statement of
 * the fix being its criterion: a test the fix could rewrite would prove nothing.
 */
export function regressionDriftOf(locked: readonly LockedTest[], specs: readonly RegressionSpec[]): Drift {
  const written = specs.flatMap((spec) =>
    spec.tests
      .filter(({ state }) => state === 'pending' || state === 'active')
      .map((test) => ({ file: spec.file, title: test.title, fingerprint: test.fingerprint })),
  );

  const toJudge: Judged[] = locked.flatMap((test) => {
    const now = written.find((candidate) => candidate.file === test.file && candidate.title === test.title);

    return now?.fingerprint === test.fingerprint
      ? []
      : [{ subject: subjectOf(test), fingerprint: now?.fingerprint ?? REMOVED, criteria: [] }];
  });

  const toLock = written
    .filter((test) => !locked.some((known) => known.file === test.file && known.title === test.title))
    .map((test) => `"${test.title}" of ${test.file} is new`);

  return { toJudge, toLock };
}

/** How a verdict names a regression test: `test "<title>" of <file>`. */
function subjectOf({ title, file }: LockedTest): string {
  return `test "${title}" of ${file}`;
}
