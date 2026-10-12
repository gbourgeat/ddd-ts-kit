import { expect } from 'vitest';
import { cli, exists, type StackFlags, tempDir } from '../helpers.js';
import { initFlags } from '../support/init-flags.js';
import { expectNoFinding } from './expect-no-finding.js';
import { installAsPublished } from './install-as-published.js';
import { bin, runIn } from './run-in.js';
import { NATIVE_COMPILER } from './type-errors.js';

/**
 * What `init` alone leaves on a stack, with the contexts it was asked for and nothing generated,
 * installed as a published kit would be (`npm run build` at the root first): no finding of the
 * checker, ESLint, dependency-cruiser and knip, no remark of knip about its own configuration,
 * specs that pass, a build, and the generated contracts exactly as the scripts of the project
 * write them, so that a template of a pristine contract cannot drift from the packages that
 * generate it.
 */
export function initAloneIsGreen(stack: StackFlags, contexts: readonly string[]): void {
  const root = tempDir('init-alone');

  expect(cli(root, 'init', ...initFlags(stack), ...contexts).code).toBe(0);

  installAsPublished(root);
  expectNoFinding(root);

  // Not a finding, and still a remark: a pattern of its configuration that matches nothing, a note it no longer needs.
  expect(runIn(root, { command: 'sh', args: ['-c', `${bin('knip')} 2>&1`] })).toBe('');
  expect(runIn(root, { command: bin('vitest'), args: ['run'] })).toMatch(/Test Files\s+\d+ passed/);

  documentsAreCurrent(root);
}

/** The documents of a project compared with what its own scripts generate, from the build the pipeline makes once. */
function documentsAreCurrent(root: string): void {
  const node = (...args: string[]): string => runIn(root, { command: process.execPath, args });

  node(NATIVE_COMPILER, '-p', 'tsconfig.build.json');

  expect(cli(root, 'build-aliases').code).toBe(0);
  expect(cli(root, 'docs', '--check').code).toBe(0);

  node('dist/scripts/events.js', '--check');

  if (exists(root, 'scripts/openapi.ts')) {
    node('dist/scripts/openapi.js', '--check');
  }
}
