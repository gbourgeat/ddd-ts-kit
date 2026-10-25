import { bin, runIn } from './run-in';

/** How each runner reports a run where every spec file passed. */
const ALL_PASSED: Readonly<Record<string, RegExp>> = {
  vitest: /Test Files\s+\d+ passed/,
  jest: /Test Suites:\s+\d+ passed/,
};

/**
 * The specs of a generated project, run by its own runner as its `test` script runs them, and
 * what that printed: Jest on the native ES modules of Node (its summary is written to stderr).
 */
export function runSpecs(root: string, tests: string, ...args: readonly string[]): string {
  if (tests !== 'jest') {
    return runIn(root, { command: bin('vitest'), args: ['run', ...args] });
  }

  const jest = ['node --experimental-vm-modules node_modules/jest/bin/jest.js', ...args, '2>&1'].join(' ');

  return runIn(root, { command: 'sh', args: ['-c', jest] });
}

/** Whether a run printed by `runSpecs` passed every spec file. */
export function allPassed(tests: string): RegExp {
  return ALL_PASSED[tests] ?? ALL_PASSED['vitest'] ?? /passed/;
}
