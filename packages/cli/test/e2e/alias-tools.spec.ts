import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STACK, read, REPO_ROOT, write } from '../helpers.js';
import { DEPCRUISE, eslintOn, KNIP } from './analyzers.js';
import {
  compiledEntries,
  compiledProject,
  DEV_RUNNER,
  linkCompiled,
  PROBE_SPEC,
  resolvedBy,
  rewriteAliases,
} from './compiled-project.js';
import { expectNoFinding } from './expect-no-finding.js';
import { bin, findingsOf, runIn } from './run-in.js';
import { SLOW } from './stacks.js';
import { started } from './started.js';
import { NATIVE_COMPILER } from './type-errors.js';

const TOOLS_COMPILER = path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc');
const HANDLER = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';
const COMMAND = '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';
const NOWHERE = "import { location } from '@/nowhere.js';";

interface Cruised {
  readonly modules: readonly { source: string; dependencies: readonly { module: string; resolved: string }[] }[];
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): one generated project, and each tool of its pipeline asked
 * where it takes an alias: the same source file for all of them, and a finding from each when
 * the alias names nothing.
 */
describe.runIf(SLOW)('every tool of a generated project resolves an alias to the same file', () => {
  let root: string;
  const kept = new Map<string, string>();

  const edit = (file: string, change: (text: string) => string): void => {
    kept.set(file, kept.get(file) ?? read(root, file));
    write(root, file, change(read(root, file)));
  };

  beforeAll(() => {
    root = compiledProject(DEFAULT_STACK);
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

      expect(files).toMatch(
        /^src\/alias-probe\.ts\n\s+Imported via '@\/alias-probe\.js' from file 'src\/alias-probe\.spec\.ts'/m,
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

    const probe = cruised.modules.find((module) => module.source === PROBE_SPEC);

    expect(probe?.dependencies.find((dependency) => dependency.module === '@/alias-probe.js')?.resolved).toBe(
      'src/alias-probe.ts',
    );

    expect(cruised.modules.filter((module) => module.source.startsWith('dist/'))).toEqual([]);
    expectNoFinding(root);
  }, 480_000);

  it('an alias that names no file is refused by the compiler, by dependency-cruiser, by knip and by the build', () => {
    edit(PROBE_SPEC, (spec) => spec.replace(/import \{ location \} from '[^']*';/, NOWHERE));

    const compiled = findingsOf(root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });

    expect(compiled).toContain("TS2307: Cannot find module '@/nowhere.js'");

    expect(
      findingsOf(root, { command: bin('depcruise'), args: ['src', '--config', '.dependency-cruiser.cjs'] }),
    ).toContain('@/nowhere.js');

    expect(findingsOf(root, KNIP)).toContain('@/nowhere.js');

    // The compiler emits in spite of the error: the rewrite step is the last one that can refuse the output.
    write(root, 'tsconfig.probe.json', JSON.stringify({ extends: './tsconfig.json', include: [PROBE_SPEC] }));
    findingsOf(root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.probe.json'] });

    expect(() => rewriteAliases(root)).toThrow(
      /alias-probe\.spec\.js, line \d+: .{1,2}@\/nowhere\.js.{1,2} names no file the build emitted/,
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

  it('eslint --fix turns a relative import into its alias, the formatter accepts the result, and a second fix changes nothing', () => {
    edit(HANDLER, (text) => text.replace(`'${COMMAND}'`, "'./issue-invoice.command.js'"));

    expect(read(root, HANDLER)).toContain("from './issue-invoice.command.js';");
    expect(findingsOf(root, eslintOn(HANDLER))).toContain('ddd-ts-kit/imports-alias-only');

    runIn(root, { command: bin('eslint'), args: ['--fix', HANDLER] });
    runIn(root, { command: bin('biome'), args: ['format', '--write', HANDLER] });

    const fixed = read(root, HANDLER);

    runIn(root, { command: bin('eslint'), args: ['--fix', HANDLER] });

    expect(fixed).toBe(kept.get(HANDLER));
    expect(read(root, HANDLER)).toBe(fixed);
    expect(findingsOf(root, { command: bin('biome'), args: ['format', HANDLER] })).toBe('');
  }, 240_000);
});

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
    expect(read(root, 'dist/src/main.js')).toContain("from './platform/compose-application.js';");
    expect(resolvedBy(root, DEV_RUNNER, '$app/main.js')).toBe('src/main.ts');

    expect(compiledEntries(root).map((entry) => started(root, process.execPath, [entry]).unresolved)).toEqual([
      false,
      false,
      false,
    ]);

    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');
  }, 480_000);
});
