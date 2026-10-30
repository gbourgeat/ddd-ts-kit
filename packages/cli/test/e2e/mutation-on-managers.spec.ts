import { describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, type StackFlags, tempDir } from '../helpers';
import { initFlags } from '../support/init-flags';
import { installForReal, type Manager } from './install-for-real';
import { runIn } from './run-in';
import { SLOW } from './stacks';

const JEST: StackFlags = { ...DEFAULT_STACK, tests: 'jest' };

const CASES = [
  ['pnpm', 'Vitest', DEFAULT_STACK],
  ['pnpm', 'Jest', JEST],
  ['npm', 'Vitest', DEFAULT_STACK],
] as const;

/** What `test:mutation` printed, whether it ended on the floor of the score (the gate at work, a non-zero exit) or not. */
function mutationRun(root: string, manager: Manager): string {
  try {
    return runIn(root, { command: manager, args: ['run', 'test:mutation'] });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1), run with the installs per package manager: `test:mutation` of a project installed
 * for real by its manager. Under the strict layout of pnpm, Stryker does not find the test runner beside itself, so the
 * config of the project names it; the run has to reach the mutants, and may then stop on the floor of the score.
 */
describe.runIf(SLOW).each(CASES)('test:mutation of a project on %s with %s', (manager, _label, stack) => {
  it('runs the mutants of an aggregate: the runner is found, the initial test run passes', () => {
    const root = tempDir(`mutation-${manager}`);

    expect(cli(root, 'init', ...initFlags(stack), '--package-manager', manager, '--context', 'billing:core').code).toBe(
      0,
    );

    expect(
      cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A bill sent to a customer').code,
    ).toBe(0);

    installForReal(root, manager);

    const printed = mutationRun(root, manager);

    expect(printed).not.toMatch(/Cannot find TestRunner plugin|no TestRunner plugins were loaded/);
    expect(printed).toMatch(/Initial test run succeeded/);
    expect(printed).toMatch(/Mutation testing 100%|All tests|Ran \d+(?:\.\d+)? tests/);
  }, 600_000);
});
