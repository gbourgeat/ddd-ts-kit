import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { decorators, type DecoratorsOptions, type DecoratorsPlugin } from '../src/vitest.js';
import { sourceMapOf } from '../src/vitest/source-map-of.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PROJECT = path.join(import.meta.dirname, 'fixtures/standard-decorators');
const VITEST = path.join(ROOT, 'node_modules/vitest/vitest.mjs');
const COMPILERS = { 'TypeScript 6': 'typescript', 'TypeScript 7 (native)': '@typescript/native' };
const workspace = mkdtempSync(path.join(os.tmpdir(), 'decorators-plugin-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

const DECORATED = [
  "import type { Clock } from './clock.js';",
  'function Noted(target: unknown): void {',
  '  void target;',
  '}',
  '',
  '@Noted',
  'export class Calendar {',
  '  today = 1;',
  '  constructor(readonly clock?: Clock) {}',
  '}',
  '',
].join('\n');

/** A project on disk: its tsconfig and one source, with the plugin set up at its root. */
function projectWith(compilerOptions: object, options: DecoratorsOptions = {}) {
  const root = mkdtempSync(path.join(workspace, 'project-'));

  writeFileSync(path.join(root, 'package.json'), '{}');
  writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions }));

  const plugin: DecoratorsPlugin = decorators({
    compiler: path.join(ROOT, 'node_modules/@typescript/native/bin/tsc'),
    ...options,
  });

  const cacheDir = path.join(root, 'cache');

  plugin.configResolved({ root, cacheDir });

  return { root, plugin, cached: () => readdirSync(path.join(cacheDir, 'ddd-ts-kit-decorators')) };
}

describe('decorators(), the Vitest plugin', () => {
  it('compiles a source that holds a decorator, keeping its imports for the runner', () => {
    const { root, plugin } = projectWith({ target: 'es2023', verbatimModuleSyntax: true });

    const result = plugin.transform(DECORATED, path.join(root, 'calendar.ts'));

    expect(result?.code).not.toMatch(/^@Noted/m);
    expect(result?.code).toContain('__esDecorate');
    expect(result?.code).not.toContain('./clock.js');
    expect(result?.code).not.toContain('sourceMappingURL');
  });

  it('answers a source map that names the real file and holds its text', () => {
    const { root, plugin } = projectWith({ target: 'es2023' });
    const file = path.join(root, 'calendar.ts');

    const map = JSON.parse(plugin.transform(DECORATED, `${file}?v=1`)?.map ?? '{}');

    expect(map).toMatchObject({ version: 3, sources: [file], sourcesContent: [DECORATED] });
    expect(map.mappings).not.toBe('');
  });

  it('leaves every other file to the runner', () => {
    const { root, plugin } = projectWith({ target: 'es2023' });
    const undecorated = 'export class Calendar {}\n/** @deprecated use the clock */\nexport const email = "a@b.c";\n';

    expect(plugin.transform(undecorated, path.join(root, 'calendar.ts'))).toBeUndefined();
    expect(plugin.transform(DECORATED, path.join(root, 'calendar.d.ts'))).toBeUndefined();
    expect(plugin.transform(DECORATED, path.join(root, 'calendar.js'))).toBeUndefined();
  });

  it('steps aside in a project compiled with experimentalDecorators, which the runner lowers itself', () => {
    const { root, plugin } = projectWith({ target: 'es2023', experimentalDecorators: true });

    expect(plugin.transform(DECORATED, path.join(root, 'calendar.ts'))).toBeUndefined();
  });

  it('follows the tsconfig nearest to the file, as the runner does', () => {
    const { root, plugin } = projectWith({ target: 'es2023' });

    mkdirSync(path.join(root, 'legacy'));

    writeFileSync(
      path.join(root, 'legacy/tsconfig.json'),
      JSON.stringify({ compilerOptions: { experimentalDecorators: true } }),
    );

    expect(plugin.transform(DECORATED, path.join(root, 'legacy/calendar.ts'))).toBeUndefined();
    expect(plugin.transform(DECORATED, path.join(root, 'calendar.ts'))).toBeDefined();
  });

  it('follows the class field semantics and the target of the project', () => {
    const defined = projectWith({ target: 'es2022', useDefineForClassFields: true });
    const assigned = projectWith({ target: 'es2022', useDefineForClassFields: false });
    const newest = projectWith({ target: 'esnext' });

    expect(defined.plugin.transform(DECORATED, path.join(defined.root, 'calendar.ts'))?.code).toMatch(
      /^\s*today = 1;/m,
    );

    expect(assigned.plugin.transform(DECORATED, path.join(assigned.root, 'calendar.ts'))?.code).toMatch(
      /this\.today = 1;/,
    );

    expect(newest.plugin.transform(DECORATED, path.join(newest.root, 'calendar.ts'))?.code).toContain('__esDecorate');
  });

  it('compiles a file once: the same text of the same file comes from the cache', () => {
    const { root, plugin, cached } = projectWith({ target: 'es2023' });
    const file = path.join(root, 'calendar.ts');

    const first = plugin.transform(DECORATED, file);
    const again = plugin.transform(DECORATED, file);

    plugin.transform(`${DECORATED}export const later = 2;\n`, file);

    expect(again).toEqual(first);
    expect(cached()).toHaveLength(2);
  });

  it('compiles again an entry of the cache that lost its output or its map, and mends it', () => {
    const { root, plugin, cached } = projectWith({ target: 'es2023' });
    const file = path.join(root, 'calendar.ts');
    const first = plugin.transform(DECORATED, file);
    const entry = path.join(root, 'cache', 'ddd-ts-kit-decorators', cached()[0] ?? '');

    rmSync(path.join(entry, 'source.js'));

    expect(plugin.transform(DECORATED, file)).toEqual(first);

    rmSync(path.join(entry, 'source.js.map'));

    expect(plugin.transform(DECORATED, file)).toEqual(first);
    expect(readdirSync(entry)).toEqual(expect.arrayContaining(['source.js', 'source.js.map']));
    expect(cached()).toHaveLength(1);
  });

  it('compiles .mts as well, and takes a tsconfig named in its options', () => {
    const named = mkdtempSync(path.join(workspace, 'named-'));

    writeFileSync(
      path.join(named, 'tsconfig.test.json'),
      JSON.stringify({ compilerOptions: { target: 'es2022', useDefineForClassFields: false } }),
    );

    const { root, plugin } = projectWith({ target: 'es2023' }, { tsconfig: path.join(named, 'tsconfig.test.json') });

    expect(plugin.transform(DECORATED, path.join(root, 'calendar.mts'))?.code).toMatch(/this\.today = 1;/);
  });

  it('says which file the compiler refuses, and why', () => {
    const { root, plugin } = projectWith({ target: 'es2023' });

    expect(() =>
      plugin.transform('@Noted\nexport class Calendar { today = ; }\n', path.join(root, 'calendar.ts')),
    ).toThrow(/refused .*calendar\.ts:\n[^]*error TS\d+/);
  });

  it('refuses a compiler package that ships no tsc', () => {
    const plugin = decorators({ compiler: 'vitest' });

    expect(() => plugin.configResolved({ root: ROOT, cacheDir: workspace })).toThrow(/ships no tsc/);
  });
});

describe('decorators(), finding its compiler and the project of a file', () => {
  it('compiles a file no tsconfig governs at the newest dated target, its fields defined', () => {
    const bare = mkdtempSync(path.join(workspace, 'bare-'));
    const plugin = decorators({ compiler: path.join(ROOT, 'node_modules/@typescript/native/bin/tsc') });

    plugin.configResolved({ root: bare, cacheDir: path.join(bare, 'cache') });

    const code = plugin.transform(DECORATED, path.join(bare, 'calendar.ts'))?.code;

    expect(code).toContain('__esDecorate');
    expect(code).toMatch(/^\s*today = 1;/m);
  });

  it('takes a compiler named by a path relative to the root, and keeps its files where it is told', () => {
    const { root } = projectWith({ target: 'es2023' });
    const kept = path.join(root, 'kept');
    const plugin = decorators({ compiler: './node_modules/@typescript/native/bin/tsc', cacheDir: kept });

    plugin.configResolved({ root: ROOT, cacheDir: path.join(root, 'unused') });

    expect(plugin.transform(DECORATED, path.join(root, 'calendar.ts'))?.code).toContain('__esDecorate');
    expect(readdirSync(kept)).toHaveLength(1);
  });

  it('compiles with the typescript package of the project when no compiler is named', () => {
    const { root } = projectWith({ target: 'es2023' });
    const file = path.join(root, 'calendar.ts');
    const plugin = decorators();

    // Before TypeScript 7, the compiler reads no tsconfig whose project holds no source.
    writeFileSync(file, DECORATED);
    plugin.configResolved({ root: ROOT, cacheDir: path.join(root, 'cache') });

    expect(plugin.transform(DECORATED, file)?.code).toContain('__esDecorate');
  }, 60_000);

  it('leaves every file to the runner until Vite resolved its configuration', () => {
    expect(decorators().transform(DECORATED, path.join(workspace, 'calendar.ts'))).toBeUndefined();
  });

  it('refuses a compiler package that ships no command at all', () => {
    const plugin = decorators({ compiler: '@faker-js/faker' });

    expect(() => plugin.configResolved({ root: ROOT, cacheDir: workspace })).toThrow(
      'The package "@faker-js/faker" ships no tsc: name the compiler to use.',
    );
  });
});

describe('the source map of a compiled file', () => {
  it('names the real file and holds its text, whatever the compiler left out of its own map', () => {
    for (const emitted of ['{"version":3}', 'null']) {
      expect(JSON.parse(sourceMapOf(emitted, '/project/calendar.ts', DECORATED))).toEqual({
        version: 3,
        sources: ['/project/calendar.ts'],
        sourcesContent: [DECORATED],
        names: [],
        mappings: '',
      });
    }
  });
});

describe('a project with standard decorators, run by the installed Vitest', () => {
  const run = (environment: Record<string, string>) =>
    spawnSync(
      process.execPath,
      [VITEST, 'run', '--root', PROJECT, '--config', path.join(PROJECT, 'vitest.config.ts')],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          DECORATORS_CACHE: mkdtempSync(path.join(workspace, 'vite-')),
          ...environment,
        },
      },
    );

  it.each(Object.entries(COMPILERS))(
    'passes with the plugin, compiling with %s',
    (_label, compiler) => {
      const outcome = run({ DECORATORS_COMPILER: compiler });

      expect(outcome.stdout + outcome.stderr).toMatch(/Tests\s+2 passed \(2\)/);
      expect(outcome.status).toBe(0);
    },
    60_000,
  );

  it('cannot even be read without it', () => {
    const outcome = run({ DECORATORS_PLUGIN: 'off' });

    expect(outcome.status).not.toBe(0);
    expect(outcome.stdout + outcome.stderr).toMatch(/SyntaxError|Invalid or unexpected token/);
  }, 60_000);
});
