import fs from 'node:fs';
import path from 'node:path';
import { aliasRoots, specifierSuffix } from '../../src/alias/index.js';
import { readConfig } from '../../src/config/index.js';
import { read, REPO_ROOT, scaffoldEverything, type StackFlags, tempDir, write } from '../helpers.js';
import { installAsPublished } from './install-as-published.js';
import { bin, runIn } from './run-in.js';
import { NATIVE_COMPILER } from './type-errors.js';

const LINKER = path.join(import.meta.dirname, 'fixtures/link-compiled.mjs');
const TSX = path.join(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs');
/** The CLI as the project installed it: what its `build` script runs after the compiler. */
const INSTALLED_CLI = 'node_modules/ddd-ts-kit/dist/bin.js';

export const PROBE = 'src/alias-probe.ts';
/** Under the source root, so that the import graph of the sources holds the probe. */
export const PROBE_SPEC = 'src/alias-probe.spec.ts';

export interface Linked {
  readonly modules: number;
  /** The emitted files that still hold an alias specifier. */
  readonly aliased: readonly string[];
  /** The emitted modules that import by a relative path. */
  readonly relative: number;
  readonly linked: number;
  readonly unresolved: readonly string[];
}

export interface Rewritten {
  readonly files: number;
  readonly changed: number;
  readonly specifiers: number;
}

/**
 * A project with every kind generated, installed as a published kit, holding a probe module that
 * says where it was loaded from and a spec that imports it by its alias, then compiled and not
 * yet rewritten: a compiled copy of the probe exists, which no tool that reads the sources may load.
 */
export function compiledOnly(stack: StackFlags, more: readonly string[] = []): string {
  const root = tempDir('alias');
  const framework = stack.tests === 'jest' ? '@jest/globals' : 'vitest';

  scaffoldEverything(root, stack, more);
  installAsPublished(root);
  write(root, PROBE, 'export const location = import.meta.url;\n');

  write(
    root,
    PROBE_SPEC,
    `import { expect, it } from '${framework}';\nimport { location } from '${spelled(root, '@/alias-probe')}';\n\nit('loads the source the alias names, not its compiled copy', () => {\n  expect(location).toMatch(/\\/src\\/alias-probe\\.ts$/);\n});\n`,
  );

  if (stack.orm === 'prisma') {
    // The client is a build product: the build of a Prisma project starts by generating it (`prebuild`).
    runIn(root, { command: bin('prisma'), args: ['generate'] });
  }

  runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.build.json'] });

  return root;
}

/**
 * A specifier as the project writes it: given under `@/` and without an extension, it takes the
 * alias of the source root and the ending the config asks for (nothing, or `.js`).
 */
export function spelled(root: string, specifier: string): string {
  const { importAlias, importExtension } = readConfig(root).config;

  return `${specifier.replace(/^@\//, importAlias)}${specifierSuffix(importExtension)}`;
}

/** The second half of the `build` script: the aliases of the compiled output become relative paths. */
export function rewriteAliases(root: string): Rewritten {
  const printed = runIn(root, { command: process.execPath, args: [INSTALLED_CLI, 'build-aliases', '--json'] });

  return JSON.parse(printed) as Rewritten;
}

/** The same project, built as `npm run build` builds it: compiled, then rewritten. */
export function compiledProject(stack: StackFlags, more: readonly string[] = []): string {
  const root = compiledOnly(stack, more);

  rewriteAliases(root);

  return root;
}

/** The two steps of the `build` script of a project, which the helpers above run one by one. */
export function buildSteps(root: string): string[] {
  const { scripts } = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };

  return (scripts['build'] ?? '').split(' && ');
}

/** What plain `node` links of the compiled output, module by module, and the aliases left in it. */
export function linkCompiled(root: string): Linked {
  const prefixes = aliasRoots(readConfig(root).config).map(({ prefix }) => prefix);

  return JSON.parse(runIn(root, { command: process.execPath, args: [LINKER, 'dist', ...prefixes] })) as Linked;
}

/** The entry points of the compiled output: the application, then each process under `apps/`. */
export function compiledEntries(root: string): string[] {
  const apps = path.join(root, 'dist/src/apps');
  const names = fs.existsSync(apps) ? fs.readdirSync(apps).sort() : [];

  return ['dist/src/main.js', ...names.map((name) => `dist/src/apps/${name}/main.js`)];
}

/** The `dev` script of the project as a command line of the dev runner, without its watch mode. */
export function devCommand(root: string): string[] {
  const { scripts } = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };
  const [runner = '', mode = '', ...rest] = (scripts['dev'] ?? '').split(' ');

  if (runner !== 'tsx' || mode !== 'watch') {
    throw new Error(`The dev script no longer starts with "tsx watch": ${scripts['dev'] ?? ''}`);
  }

  return [TSX, ...rest];
}

/** Where a runtime resolves an alias specifier from the project root: the file it would load. */
export function resolvedBy(root: string, runner: readonly string[], specifier: string): string {
  const probe = `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`;
  const printed = runIn(root, { command: process.execPath, args: [...runner, '--input-type=module', '-e', probe] });

  return path.relative(fs.realpathSync(root), new URL(printed.trim()).pathname);
}

/** The dev runner with no flag: it reads the `paths` of tsconfig.json by itself. */
export const DEV_RUNNER = [TSX];
