import type { AcceptanceProblem } from './acceptance-problem.js';
import type { RegressionSpec, RegressionTest } from './regression-spec.js';

/**
 * What keeps a fix from its gates: a listed spec that is missing or holds no test (`written`), a
 * test still to write (`written`), one the runner puts aside (always), one still wrapped in
 * `pending(...)` (`passing`: the proof of a fix runs, and fails until the fix).
 */
export function regressionProblems(story: string, specs: readonly RegressionSpec[]): AcceptanceProblem[] {
  return specs.flatMap((spec) => specProblems(story, spec));
}

function specProblems(story: string, spec: RegressionSpec): AcceptanceProblem[] {
  if (!spec.found) {
    return [
      {
        kind: 'regression-missing',
        at: spec.file,
        message: `${spec.file} is listed under \`## Regression\` of ${story} and does not exist: write the failing spec there, or list the file that holds it.`,
        from: 'written',
      },
    ];
  }

  if (!spec.tests.some(isTest)) {
    return [
      {
        kind: 'regression-empty',
        at: spec.file,
        message: `${spec.file} holds no test: write the test that reproduces the defect (\`it('<what the defect broke>', ...)\`), and see it fail on an assertion.`,
        from: 'written',
      },
    ];
  }

  return spec.tests.flatMap((test) => testProblems(spec.file, test));
}

function testProblems(file: string, test: RegressionTest): AcceptanceProblem[] {
  const at = `${file}:${test.line}`;
  const quoted = `"${test.title}"`;

  if (test.state === 'todo') {
    return [{ kind: 'todo', at, message: `${quoted} is still an it.todo: write the test.`, from: 'written' }];
  }

  if (test.state === 'skipped') {
    return [
      {
        kind: 'skipped',
        at,
        message: `${quoted} is put aside by the runner: a regression test runs, and fails until the fix.`,
      },
    ];
  }

  if (test.state === 'pending') {
    return [
      {
        kind: 'pending',
        at,
        message: `${quoted} is wrapped in pending(...): a regression test is not; remove the wrapper once it passes.`,
        from: 'passing',
      },
    ];
  }

  return [];
}

/** A test that counts as written: active, or pending until the fix. */
function isTest({ state }: RegressionTest): boolean {
  return state === 'pending' || state === 'active';
}
