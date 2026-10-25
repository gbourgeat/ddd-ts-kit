import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { read, REPO_ROOT, type StackFlags, walk, write } from '../helpers';
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
  spelled,
} from './compiled-project';
import { bin, findingsOf, runIn } from './run-in';
import { FIRST_CLASS, label, SLOW, STACKS } from './stacks';
import { type Started, started } from './started';

const installed = (name: string): boolean => fs.existsSync(path.join(REPO_ROOT, 'node_modules', name));

/** What a stack imports that this workspace does not install: its compiled output cannot be loaded here. */
const MISSING: Readonly<Record<string, string>> = { typeorm: 'typeorm' };

const loadable = (stack: StackFlags): boolean =>
  MISSING[stack.orm] === undefined || installed(MISSING[stack.orm] ?? '');

const RUNNABLE = STACKS.filter(loadable);
const READS_TSCONFIG = /\n\s*resolve: \{ tsconfigPaths: true \},/;
const JEST_MAPPER = /\n\s*moduleNameMapper: \{[^}]*\},/;

const WITH_JS = ['--import-extension', 'js'];

/** Kept alive next to the default: the default stack, the stack of the example, and jest, whose mapping differs. */
const WRITTEN_WITH_JS = [STACKS[0], { ...FIRST_CLASS, broker: 'redis' }, STACKS.find((stack) => stack.tests === 'jest')]
  .filter((stack) => stack !== undefined)
  .filter(loadable);

export type AliasCase = readonly [label: string, stack: StackFlags, more: readonly string[]];

/**
 * Every stack the workspace can load, generated as `init` writes it, its imports without an
 * extension; three of them generated again with `--import-extension js`. Split between two spec
 * files that the alias job runs side by side (`ci:test:alias`): each holds every other case.
 */
export const CASES: readonly AliasCase[] = [
  ...RUNNABLE.map((stack) => [label(stack), stack, [] as readonly string[]] as const),
  ...WRITTEN_WITH_JS.map((stack) => [`imports written with ".js", ${label(stack)}`, stack, WITH_JS] as const),
];

/** The cases of one of the two files: every other one, from the first or from the second. */
export function halfOfTheCases(from: 0 | 1): readonly AliasCase[] {
  return CASES.filter((_, index) => index % 2 === from);
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): each case compiled with the native compiler, then held to
 * what the alias promises: the build rewrites it, plain `node` runs the compiled output, the dev
 * runner and the test runner are answered the sources.
 */
export function describeTheAliasAtRunTime(cases: readonly AliasCase[]): void {
  describe.runIf(SLOW).each(cases)('the import alias at run time (%s)', (_label, stack, more) => {
    let root: string;
    let bare: Started;
    let rewritten: Rewritten;
    const bareSpelling = more.length === 0;

    // Each project holds a copy of every package of the kit and its own node_modules: kept until the end of the
    // file, the stacks of one half filled the disk of a runner. Removed as soon as its cases are done.
    afterAll(async () => {
      await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }, 120_000);

    beforeAll(() => {
      root = compiledOnly(stack, more);
      bare = started(root, process.execPath, ['dist/src/main.js']);
      rewritten = rewriteAliases(root);
    }, 240_000);

    it('compiled and not rewritten, the output stops under plain node at its first alias: the rewrite step is what makes it run', () => {
      expect(bare.unresolved, bare.output).toBe(true);
      expect(bare.output).toContain("'@/");

      expect(read(root, 'src/main.ts')).toContain(
        `from '${spelled(root, '@/platform/composition/compose-application')}';`,
      );

      expect(spelled(root, '@/main')).toBe(bareSpelling ? '@/main' : '@/main.js');
      expect(sourcesWrittenTheOtherWay(root, bareSpelling)).toEqual([]);
      expect(rewritten.specifiers).toBeGreaterThan(50);
      expect(buildSteps(root).at(-1)).toBe('ddd-ts-kit build-aliases');
      expect(buildSteps(root).at(-2)).toContain('tsc -p tsconfig.build.json');
    });

    it('plain node links every compiled module: no loader, no flag, no alias left in a .js or a .d.ts', () => {
      const linked = linkCompiled(root);
      const unknown = started(root, process.execPath, ['--input-type=module', '-e', "await import('@/main.js')"]);

      const extensionless = started(root, process.execPath, [
        '--input-type=module',
        '-e',
        "await import('./dist/src/main')",
      ]);

      expect(linked.unresolved).toEqual([]);
      expect(linked.aliased).toEqual([]);
      expect(linked.relative).toBeGreaterThan(10);
      expect(linked.linked).toBe(linked.modules);
      expect(unknown.unresolved, 'Node itself knows no alias: only the rewrite made the output run').toBe(true);
      expect(extensionless.unresolved, 'Node completes no extension: the rewrite wrote each one').toBe(true);
      expect(read(root, 'dist/src/main.js')).toContain("from './platform/composition/compose-application.js';");
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
      expect(command).toContain('./src/platform/observability/tracing.ts');
      expect(resolvedBy(root, DEV_RUNNER, spelled(root, '@/main'))).toBe('src/main.ts');
      expect(resolvedBy(root, DEV_RUNNER, spelled(root, '@/alias-probe'))).toBe('src/alias-probe.ts');

      expect(resolvedBy(root, DEV_RUNNER, `$test/architecture/extractable.spec${bareSpelling ? '' : '.js'}`)).toBe(
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

        expect(findingsOf(root, vitest)).toMatch(
          /Cannot find package '@\/alias-probe(?:\.js)?'|Failed to resolve import/,
        );

        write(root, 'vitest.config.ts', config);
      },
      120_000,
    );

    it.runIf(stack.tests === 'jest')(
      'the jest config maps each alias to its source, never to the compiled copy',
      () => {
        const mapper = JEST_MAPPER.exec(read(root, 'jest.config.js'))?.[0] ?? '';

        const ending = bareSpelling ? '' : '\\\\.js';

        expect(mapper).toContain(`'^@/(.*)${ending}$': ${jestTarget(bareSpelling, 'src')},`);
        expect(mapper).toContain(`'^\\\\$test/(.*)${ending}$': ${jestTarget(bareSpelling, 'test')},`);
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
  });
}

const PROJECT_IMPORT = /(?:\bfrom|\bimport\(?)\s*['"]((?:@|\$[a-z][a-z0-9-]*)\/[^'"]*)['"]/g;

/** The project imports of the sources that do not end as the config asks: with `.js` in a project that writes none, or without it. */
function sourcesWrittenTheOtherWay(root: string, bareSpelling: boolean): string[] {
  return ['src', 'test', 'scripts']
    .flatMap((tree) => walk(root, tree).filter((file) => file.endsWith('.ts')))
    .flatMap((file) =>
      [...read(root, file).matchAll(PROJECT_IMPORT)]
        .map((found) => found[1] ?? '')
        .filter((specifier) => /\.[cm]?[jt]s$/.test(specifier) === bareSpelling)
        .map((specifier) => `${file}: ${specifier}`),
    );
}

/** Where the jest config maps an alias: the source and, without an ending, which can name a directory, its barrel after it. */
function jestTarget(bareSpelling: boolean, directory: string): string {
  return bareSpelling
    ? `['<rootDir>/${directory}/$1.ts', '<rootDir>/${directory}/$1/index.ts']`
    : `'<rootDir>/${directory}/$1.ts'`;
}
