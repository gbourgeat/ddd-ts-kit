import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { read, REPO_ROOT, type StackFlags, write } from '../helpers.js';
import {
  buildSteps,
  compiledEntries,
  compiledOnly,
  DEV_RUNNER,
  devCommand,
  linkCompiled,
  PROBE_SPEC,
  resolvedBy,
  type Rewritten,
  rewriteAliases,
} from './compiled-project.js';
import { bin, findingsOf, runIn } from './run-in.js';
import { label, SLOW, STACKS } from './stacks.js';
import { type Started, started } from './started.js';

const installed = (name: string): boolean => fs.existsSync(path.join(REPO_ROOT, 'node_modules', name));

/** What a stack imports that this workspace does not install: its compiled output cannot be loaded here. */
const MISSING: Readonly<Record<string, string>> = { typeorm: 'typeorm' };

const loadable = (stack: StackFlags): boolean =>
  MISSING[stack.orm] === undefined || installed(MISSING[stack.orm] ?? '');

const RUNNABLE = STACKS.filter(loadable);
const READS_TSCONFIG = /\n\s*resolve: \{ tsconfigPaths: true \},/;
const JEST_MAPPER = /\n\s*moduleNameMapper: \{[^}]*\},/;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): every stack the workspace can load, compiled with the native
 * compiler, then held to what the alias promises: the build rewrites it, plain `node` runs the
 * compiled output, the dev runner and the test runner are answered the sources.
 */
describe.runIf(SLOW).each(RUNNABLE.map((stack) => [label(stack), stack] as const))(
  'the import alias at run time (%s)',
  (_label, stack) => {
    let root: string;
    let bare: Started;
    let rewritten: Rewritten;

    beforeAll(() => {
      root = compiledOnly(stack);
      bare = started(root, process.execPath, ['dist/src/main.js']);
      rewritten = rewriteAliases(root);
    }, 240_000);

    it('compiled and not rewritten, the output stops under plain node at its first alias: the rewrite step is what makes it run', () => {
      expect(bare.unresolved, bare.output).toBe(true);
      expect(bare.output).toContain("'@/");
      expect(rewritten.specifiers).toBeGreaterThan(50);
      expect(buildSteps(root).at(-1)).toBe('ddd-ts-kit build-aliases');
      expect(buildSteps(root).at(-2)).toContain('tsc -p tsconfig.build.json');
    });

    it('plain node links every compiled module: no loader, no flag, no alias left in a .js or a .d.ts', () => {
      const linked = linkCompiled(root);
      const unknown = started(root, process.execPath, ['--input-type=module', '-e', "await import('@/main.js')"]);

      expect(linked.unresolved).toEqual([]);
      expect(linked.aliased).toEqual([]);
      expect(linked.relative).toBeGreaterThan(10);
      expect(linked.linked).toBe(linked.modules);
      expect(unknown.unresolved, 'Node itself knows no alias: only the rewrite made the output run').toBe(true);
      expect(rewriteAliases(root)).toMatchObject({ changed: 0, specifiers: 0 });
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

    it('the dev runner is answered the sources, although a compiled copy exists, and starts the application from them, tracing imported first', () => {
      const command = devCommand(root);
      const run = started(root, process.execPath, command);

      expect(command).toContain('--import');
      expect(command).toContain('./src/platform/tracing.ts');
      expect(resolvedBy(root, DEV_RUNNER, '@/main.js')).toBe('src/main.ts');
      expect(resolvedBy(root, DEV_RUNNER, '@/alias-probe.js')).toBe('src/alias-probe.ts');

      expect(resolvedBy(root, DEV_RUNNER, '$test/architecture/extractable.spec.js')).toBe(
        'test/architecture/extractable.spec.ts',
      );

      expect(run.unresolved, run.output).toBe(false);
      expect(run.output).not.toContain('dist/src/');
    }, 120_000);

    it.runIf(stack.tests === 'vitest')(
      'vitest runs a spec on the source an alias names, although a compiled copy exists, and resolves nothing once it stops reading tsconfig',
      () => {
        const vitest = { command: bin('vitest'), args: ['run', PROBE_SPEC] };
        const config = read(root, 'vitest.config.ts');

        expect(fs.existsSync(path.join(root, 'dist/src/alias-probe.js'))).toBe(true);
        expect(runIn(root, vitest)).toMatch(/Tests\s+1 passed/);

        write(root, 'vitest.config.ts', config.replace(READS_TSCONFIG, ''));

        expect(read(root, 'vitest.config.ts')).not.toBe(config);
        expect(findingsOf(root, vitest)).toMatch(/Cannot find package '@\/alias-probe\.js'|Failed to resolve import/);

        write(root, 'vitest.config.ts', config);
      },
      120_000,
    );

    it.runIf(stack.tests === 'jest')(
      'the jest config maps each alias to its source, never to the compiled copy',
      () => {
        const mapper = JEST_MAPPER.exec(read(root, 'jest.config.js'))?.[0] ?? '';

        expect(mapper).toContain("'^@/(.*)\\\\.js$': '<rootDir>/src/$1.ts',");
        expect(mapper).toContain("'^\\\\$test/(.*)\\\\.js$': '<rootDir>/test/$1.ts',");
        expect(mapper).not.toContain('dist');
      },
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
