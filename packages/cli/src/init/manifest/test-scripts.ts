import type { Config } from '../../config';

const JEST = 'node --experimental-vm-modules node_modules/jest/bin/jest.js';
const NO_END_TO_END = { 'ci:test:e2e': 'echo "No HTTP stack: nothing to drive end to end."' };

/**
 * `test` is the fast run a developer repeats; `test:coverage` runs every spec once and holds the four
 * layers of every context to their thresholds, which is what `verify` calls. The pipeline splits the
 * same measure between its unit and integration jobs.
 */
export function testScripts(config: Config): Record<string, string> {
  const { http, tests } = config.stack;

  if (tests === 'jest') {
    return jestScripts(http !== 'none');
  }

  return {
    test: 'vitest run',
    'test:coverage': 'vitest run --coverage',
    // Stryker on the domain layer of every context, then each context held to the floor of the config: the night of the pipeline runs it.
    'test:mutation': 'stryker run && ddd-ts-kit mutation',
    ...(http === 'none' ? NO_END_TO_END : { 'test:e2e': 'vitest run --config vitest.e2e.config.ts --passWithNoTests' }),
  };
}

function jestScripts(endToEnd: boolean): Record<string, string> {
  const e2e = `${JEST} --config jest.e2e.config.js --passWithNoTests`;

  return {
    test: JEST,
    'test:coverage': `${JEST} --coverage`,
    'ci:test:unit': `${JEST} --coverage`,
    'ci:test:integration': 'echo "Adapter specs run with the unit specs under jest."',
    'test:mutation': 'stryker run && ddd-ts-kit mutation',
    ...(endToEnd ? { 'test:e2e': e2e, 'ci:test:e2e': e2e } : NO_END_TO_END),
  };
}
