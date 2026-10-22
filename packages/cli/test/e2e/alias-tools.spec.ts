import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STACK, read, REPO_ROOT, write } from '../helpers';
import { DEPCRUISE, KNIP } from './analyzers';
import {
  compiledEntries,
  compiledProject,
  DEV_RUNNER,
  linkCompiled,
  PROBE_SPEC,
  resolvedBy,
  rewriteAliases,
  spelled,
} from './compiled-project';
import { expectNoFinding } from './expect-no-finding';
import { bin, findingsOf, runIn } from './run-in';
import { SLOW } from './stacks';
import { started } from './started';
import { NATIVE_COMPILER } from './type-errors';

const TOOLS_COMPILER = path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc');
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`);

/** The two spellings a project can take: the default of `init`, and the one kept for the projects written before it. */
const SPELLINGS = [
  ['no extension, as init writes it', [], ''],
  ['".js", asked with --import-extension js', ['--import-extension', 'js'], '.js'],
] as const;

interface Cruised {
  readonly modules: readonly { source: string; dependencies: readonly { module: string; resolved: string }[] }[];
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): one generated project, and each tool of its pipeline asked
 * where it takes an alias: the same source file for all of them, and a finding from each when
 * the alias names nothing. The whole list is replayed in each of the two spellings of an import.
 */
describe.runIf(SLOW).each(SPELLINGS)(
  'every tool of a generated project resolves an alias to the same file (%s)',
  (_spelling, flags, suffix) => {
    let root: string;
    const kept = new Map<string, string>();
    const probe = `@/alias-probe${suffix}`;
    const nowhere = `@/nowhere${suffix}`;

    const edit = (file: string, change: (text: string) => string): void => {
      kept.set(file, kept.get(file) ?? read(root, file));
      write(root, file, change(read(root, file)));
    };

    beforeAll(() => {
      root = compiledProject(DEFAULT_STACK, flags);
    }, 240_000);

    afterEach(() => {
      kept.forEach((content, file) => write(root, file, content));
      kept.clear();
    });

    it.each([
      ['the native compiler that builds', NATIVE_COMPILER],
      ['the compiler of the tools', TOOLS_COMPILER],
    ])(
      '%s maps the alias to its source',
      (_name, compiler) => {
        write(root, 'tsconfig.probe.json', JSON.stringify({ extends: './tsconfig.json', include: [PROBE_SPEC] }));

        const files = runIn(root, {
          command: process.execPath,
          args: [compiler, '-p', 'tsconfig.probe.json', '--noEmit', '--explainFiles'],
        });

        expect(spelled(root, '@/alias-probe')).toBe(probe);

        expect(files).toMatch(
          new RegExp(
            String.raw`^src\/alias-probe\.ts\n\s+Imported via '${escaped(probe)}' from file 'src\/alias-probe\.spec\.ts'`,
            'm',
          ),
        );

        expect(files).not.toMatch(/^dist\//m);
      },
      240_000,
    );

    it('dependency-cruiser follows the alias to its source, and knip, ESLint and the checker have nothing to say', () => {
      const cruised = JSON.parse(
        runIn(root, {
          command: bin('depcruise'),
          args: ['src', '--config', '.dependency-cruiser.cjs', '-T', 'json'],
        }),
      ) as Cruised;

      const spec = cruised.modules.find((module) => module.source === PROBE_SPEC);

      expect(spec?.dependencies.find((dependency) => dependency.module === probe)?.resolved).toBe('src/alias-probe.ts');

      expect(cruised.modules.filter((module) => module.source.startsWith('dist/'))).toEqual([]);
      expectNoFinding(root);
    }, 480_000);

    it('an alias that names no file is refused by the compiler, by dependency-cruiser, by knip and by the build', () => {
      edit(PROBE_SPEC, (spec) =>
        spec.replace(/import \{ location \} from '[^']*';/, `import { location } from '${nowhere}';`),
      );

      const compiled = findingsOf(root, {
        command: process.execPath,
        args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
      });

      const checkedByTools = findingsOf(root, {
        command: process.execPath,
        args: [TOOLS_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
      });

      expect(compiled).toContain(`TS2307: Cannot find module '${nowhere}'`);
      expect(checkedByTools).toContain(`TS2307: Cannot find module '${nowhere}'`);

      expect(
        findingsOf(root, { command: bin('depcruise'), args: ['src', '--config', '.dependency-cruiser.cjs'] }),
      ).toContain(nowhere);

      expect(findingsOf(root, KNIP)).toContain(nowhere);

      // The compiler emits in spite of the error: the rewrite step is the last one that can refuse the output.
      write(root, 'tsconfig.probe.json', JSON.stringify({ extends: './tsconfig.json', include: [PROBE_SPEC] }));
      findingsOf(root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.probe.json'] });

      expect(() => rewriteAliases(root)).toThrow(
        new RegExp(
          String.raw`alias-probe\.spec\.js, line \d+: .{1,2}${escaped(nowhere)}.{1,2} names no file the build emitted`,
        ),
      );

      fs.rmSync(path.join(root, 'dist/src/alias-probe.spec.js'));
      fs.rmSync(path.join(root, 'dist/src/alias-probe.spec.d.ts'), { force: true });
    }, 240_000);

    it('knip still sees a file nothing imports: an alias hides no dead code', () => {
      write(root, 'src/platform/forgotten.ts', 'export const forgotten = 1;\n');

      expect(findingsOf(root, KNIP)).toContain('src/platform/forgotten.ts');
      expect(findingsOf(root, DEPCRUISE)).toContain('no-orphans: src/platform/forgotten.ts');

      write(root, 'src/platform/forgotten.ts', '');
      edit('src/platform/forgotten.ts', () => 'export {};\n');
    }, 240_000);
  },
);

/** Slow, opt-in: the same project under another alias, asked for at `init`, held to its whole pipeline and run. */
describe.runIf(SLOW)('a project initialised with --import-alias "$app/"', () => {
  let root: string;

  beforeAll(() => {
    root = compiledProject(DEFAULT_STACK, ['--import-alias', '$app/']);
  }, 240_000);

  it('has no finding: the checker, ESLint, dependency-cruiser, knip', () => {
    expectNoFinding(root);
  }, 480_000);

  it('runs compiled with plain node, and from its sources under the dev runner and vitest', () => {
    const specs = runIn(root, { command: bin('vitest'), args: ['run'] });

    expect(linkCompiled(root).unresolved).toEqual([]);
    expect(linkCompiled(root).aliased).toEqual([]);
    expect(read(root, 'dist/src/main.js')).toContain("from './platform/composition/compose-application.js';");
    expect(resolvedBy(root, DEV_RUNNER, '$app/main')).toBe('src/main.ts');

    expect(compiledEntries(root).map((entry) => started(root, process.execPath, [entry]).unresolved)).toEqual([
      false,
      false,
      false,
    ]);

    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');
  }, 480_000);
});
