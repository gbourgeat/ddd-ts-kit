import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { read, REPO_ROOT } from '../helpers.js';
import { buildSteps, compiledEntries, DEV_RUNNER, linkCompiled, resolvedBy } from './compiled-project.js';
import { runIn } from './run-in.js';
import { SLOW } from './stacks.js';
import { started } from './started.js';

const EXAMPLE = path.join(REPO_ROOT, 'examples/scheduling');
const ENTRIES = ['dist/src/main.js', 'dist/src/apps/worker/main.js'];

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): the example application, built by its own `build` script,
 * held to what the alias promises on the Node that runs this suite.
 */
describe.runIf(SLOW)('the import alias at run time (the example application)', () => {
  let built: string;

  beforeAll(() => {
    built = runIn(EXAMPLE, { command: 'npm', args: ['run', 'build'] });
  }, 240_000);

  it('builds in two steps, the compiler then the rewrite, and leaves no alias in its output', () => {
    const linked = linkCompiled(EXAMPLE);

    expect(buildSteps(EXAMPLE).at(-1)).toMatch(/ build-aliases$/);
    expect(built).toMatch(/rewritten {2}\d+ alias specifier\(s\) in \d+ of \d+ file\(s\) under dist\//);
    expect(read(EXAMPLE, 'dist/src/main.js')).not.toMatch(/from '@\//);
    expect(linked.aliased).toEqual([]);
    expect(linked.unresolved).toEqual([]);
    expect(linked.relative).toBeGreaterThan(200);
    expect(linked.linked).toBe(linked.modules);
  }, 240_000);

  it('plain node starts each compiled entry point up to its configuration: no loader, no flag', () => {
    expect(compiledEntries(EXAMPLE)).toEqual(expect.arrayContaining(ENTRIES));

    for (const entry of compiledEntries(EXAMPLE)) {
      const run = started(EXAMPLE, process.execPath, [entry]);

      expect(run.unresolved, `${entry}\n${run.output}`).toBe(false);
      expect(run.running || run.done || run.output.includes('dist/src/'), run.output).toBe(true);
    }
  }, 120_000);

  it('the dev runner is answered its sources, although the compiled copy now exists', () => {
    expect(resolvedBy(EXAMPLE, DEV_RUNNER, '@/main')).toBe('src/main.ts');
    expect(resolvedBy(EXAMPLE, DEV_RUNNER, '$scripts/openapi')).toBe('scripts/openapi.ts');
  }, 120_000);
});
