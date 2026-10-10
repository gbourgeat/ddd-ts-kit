import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { read, REPO_ROOT, type StackFlags, write } from '../helpers.js';
import {
  compiledEntries,
  compiledProject,
  DEV_RUNNER,
  devCommand,
  linkCompiled,
  PROBE_SPEC,
  resolvedBy,
} from './compiled-project.js';
import { bin, findingsOf, runIn } from './run-in.js';
import { label, SLOW, STACKS } from './stacks.js';
import { started } from './started.js';

const installed = (name: string): boolean => fs.existsSync(path.join(REPO_ROOT, 'node_modules', name));

/** What a stack imports that this workspace does not install: its compiled output cannot be loaded here. */
const MISSING: Readonly<Record<string, string>> = { typeorm: 'typeorm' };

const loadable = (stack: StackFlags): boolean =>
  MISSING[stack.orm] === undefined || installed(MISSING[stack.orm] ?? '');

const RUNNABLE = STACKS.filter(loadable);
const SOURCE_CONDITION_LINE = /\n\s*ssr: \{ resolve: \{ conditions: \['ddd-ts-kit-source'\] \} \},/;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): every stack the workspace can load, built with the native
 * compiler, then held to what the alias promises: plain `node` runs the compiled output, the dev
 * runner and the test runner are answered the sources, from the one declaration of package.json.
 */
describe.runIf(SLOW).each(RUNNABLE.map((stack) => [label(stack), stack] as const))(
  'the import alias at run time (%s)',
  (_label, stack) => {
    let root: string;

    beforeAll(() => {
      root = compiledProject(stack);
    }, 240_000);

    it('plain node links every compiled module: no loader, no flag, no alias left unresolved', () => {
      const linked = linkCompiled(root);

      expect(linked.unresolved).toEqual([]);
      expect(linked.aliased).toBeGreaterThan(10);
      expect(linked.linked).toBe(linked.modules);
      expect(resolvedBy(root, [], '#src/main.js')).toBe('dist/src/main.js');
    }, 120_000);

    it('plain node starts each compiled entry point: the application, the worker, a context run alone', () => {
      const entries = compiledEntries(root);

      expect(entries).toEqual(['dist/src/main.js', 'dist/src/apps/shipping/main.js', 'dist/src/apps/worker/main.js']);

      for (const entry of entries) {
        const run = started(root, process.execPath, [entry]);

        expect(run.unresolved, `${entry}\n${run.output}`).toBe(false);
        expect(run.running || run.done || run.output.includes('dist/src/'), run.output).toBe(true);
      }
    }, 120_000);

    it('the dev runner is answered the sources, although a compiled copy exists, and starts the application from them', () => {
      const run = started(root, process.execPath, devCommand(root));

      expect(resolvedBy(root, DEV_RUNNER, '#src/main.js')).toBe('src/main.ts');

      expect(resolvedBy(root, DEV_RUNNER, '#test/architecture/extractable.spec.js')).toBe(
        'test/architecture/extractable.spec.ts',
      );

      expect(run.unresolved, run.output).toBe(false);
      expect(run.output).not.toContain('dist/src/');
    }, 120_000);

    it.runIf(stack.tests === 'vitest')(
      'vitest runs a spec on the source an alias names, and on its compiled copy once the condition is gone',
      () => {
        const vitest = { command: bin('vitest'), args: ['run', PROBE_SPEC] };
        const config = read(root, 'vitest.config.ts');

        expect(runIn(root, vitest)).toMatch(/Tests\s+1 passed/);

        write(root, 'vitest.config.ts', config.replace(SOURCE_CONDITION_LINE, ''));

        expect(findingsOf(root, vitest)).toContain('to match /\\/src\\/alias-probe\\.ts$/');

        write(root, 'vitest.config.ts', config);
      },
      120_000,
    );

    it.runIf(stack.tests === 'jest' && installed('jest'))(
      'jest runs a spec on the source an alias names',
      () => {
        const jest = path.join(REPO_ROOT, 'node_modules/jest/bin/jest.js');
        const run = runIn(root, { command: process.execPath, args: ['--experimental-vm-modules', jest, PROBE_SPEC] });

        expect(run).not.toContain('failed');
      },
      120_000,
    );
  },
);
