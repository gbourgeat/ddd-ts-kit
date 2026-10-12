import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { cli, read, REPO_ROOT, tempDir, walk, write } from './helpers.js';
import { jsonAt } from './support/json-at.js';

const NATIVE_COMPILER = `${REPO_ROOT}/node_modules/@typescript/native/bin/tsc`;

const CONFIG = JSON.stringify({ contexts: {} });

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2023',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    skipLibCheck: true,
    declaration: true,
    sourceMap: true,
    declarationMap: true,
    types: [],
    rootDir: '.',
    outDir: 'dist',
    paths: { '@/*': ['./src/*'], '$test/*': ['./test/*'], '$scripts/*': ['./scripts/*'] },
  },
  include: ['src', 'scripts', 'test'],
});

const SOURCES: Readonly<Record<string, string>> = {
  'src/main.ts':
    "import { greeting } from '@/contexts/billing/domain/greeting.js';\nimport { PLACE } from '@/platform/place.js';\n\nconst { later } = await import('@/platform/later.js');\n\nconsole.log(greeting(PLACE), later);\n",
  'src/platform/place.ts': "export const PLACE: string = 'world';\n",
  'src/platform/later.ts':
    "export type { Greeting } from '@/contexts/billing/domain/greeting.js';\nexport const later = 'later';\n",
  'src/contexts/billing/domain/greeting.ts':
    "import { PLACE } from '@/platform/place.js';\n\nexport type Greeting = `hello ${string}`;\nexport const greeting = (place = PLACE): Greeting => `hello ${place}`;\nexport const lazy = (): Promise<typeof import('@/platform/place.js')> => import('@/platform/place.js');\n",
  'scripts/print.ts':
    "import { greeting } from '@/contexts/billing/domain/greeting.js';\n\nconsole.log(greeting('script'));\n",
};

/** A small project compiled by the native compiler, as `npm run build` does before the rewrite. */
function compiled(extra: Readonly<Record<string, string>> = {}): string {
  const root = tempDir('build-aliases');

  write(root, 'ddd-ts-kit.config.json', CONFIG);
  write(root, 'package.json', JSON.stringify({ name: 'compiled', type: 'module' }));
  write(root, 'tsconfig.json', TSCONFIG);
  write(root, 'tsconfig.build.json', JSON.stringify({ extends: './tsconfig.json', exclude: ['test'] }));
  Object.entries({ ...SOURCES, ...extra }).forEach(([file, content]) => write(root, file, content));
  execFileSync(process.execPath, [NATIVE_COMPILER, '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'pipe' });

  return root;
}

const node = (root: string, entry: string): { status: number | null; output: string } => {
  const run = spawnSync(process.execPath, [entry], { cwd: root, encoding: 'utf8', env: { PATH: process.env['PATH'] } });

  return { status: run.status, output: `${run.stdout}\n${run.stderr}` };
};

const emitted = (root: string, extension: string): Record<string, string> =>
  Object.fromEntries(
    execFileSync('find', ['dist', '-name', `*${extension}`], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((file) => file !== '')
      .sort()
      .map((file) => [file, read(root, file)]),
  );

describe('ddd-ts-kit build-aliases', () => {
  it('without it the compiled output stops at its first import under plain node; with it the application and a script run', () => {
    const root = compiled();
    const before = node(root, 'dist/src/main.js');

    expect(before.status).not.toBe(0);
    expect(before.output).toMatch(/ERR_MODULE_NOT_FOUND|Cannot find package '@\//);
    expect(read(root, 'dist/src/main.js')).toContain("from '@/platform/place.js'");

    const result = cli(root, 'build-aliases');

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^rewritten {2}\d+ alias specifier\(s\) in \d+ of \d+ file\(s\) under dist\/$/);
    expect(node(root, 'dist/src/main.js')).toEqual({ status: 0, output: 'hello world later\n\n' });
    expect(node(root, 'dist/scripts/print.js')).toEqual({ status: 0, output: 'hello script\n\n' });
  });

  it('writes the relative path of the emitted file, with its extension, in the JavaScript and in the declarations', () => {
    const root = compiled();

    expect(cli(root, 'build-aliases', '--json').json()).toEqual({
      outDir: 'dist',
      files: 10,
      changed: 5,
      specifiers: 8,
    });

    expect(read(root, 'dist/src/main.js')).toContain("from './contexts/billing/domain/greeting.js';");
    expect(read(root, 'dist/src/main.js')).toContain("from './platform/place.js';");
    expect(read(root, 'dist/src/main.js')).toContain("await import('./platform/later.js')");
    expect(read(root, 'dist/src/contexts/billing/domain/greeting.js')).toContain("from '../../../platform/place.js';");
    expect(read(root, 'dist/src/platform/later.d.ts')).toContain("from '../contexts/billing/domain/greeting.js';");
    expect(read(root, 'dist/scripts/print.js')).toContain("from '../src/contexts/billing/domain/greeting.js';");

    expect(read(root, 'dist/src/contexts/billing/domain/greeting.d.ts')).toMatch(
      /Promise<typeof import\(["']\.\.\/\.\.\/\.\.\/platform\/place\.js["']\)>/,
    );

    expect(Object.values({ ...emitted(root, '.js'), ...emitted(root, '.d.ts') }).join('\n')).not.toMatch(/['"]@\//);
  });

  it('leaves the source maps as the compiler wrote them, and no line of an emitted file moves', () => {
    const root = compiled();
    const maps = emitted(root, '.map');

    const lines = (files: Record<string, string>): number[] =>
      Object.values(files).map((text) => text.split('\n').length);

    const before = lines({ ...emitted(root, '.js'), ...emitted(root, '.d.ts') });

    cli(root, 'build-aliases');

    expect(Object.keys(maps).length).toBe(10);
    expect(emitted(root, '.map')).toEqual(maps);
    expect(jsonAt(JSON.parse(maps['dist/src/main.js.map'] ?? '{}'), 'sources')).toEqual(['../../src/main.ts']);
    expect(lines({ ...emitted(root, '.js'), ...emitted(root, '.d.ts') })).toEqual(before);
  });

  it('is idempotent: a second run finds nothing left to rewrite', () => {
    const root = compiled();

    cli(root, 'build-aliases');

    const once = { ...emitted(root, '.js'), ...emitted(root, '.d.ts') };

    expect(cli(root, 'build-aliases', '--json').json()).toMatchObject({ changed: 0, specifiers: 0 });
    expect({ ...emitted(root, '.js'), ...emitted(root, '.d.ts') }).toEqual(once);
  });
});

describe('ddd-ts-kit build-aliases, its refusals and its options', () => {
  it('refuses, and writes nothing, when the output imports a file the build does not emit or completes an alias at run time', () => {
    const root = compiled({
      'src/platform/ambient.d.ts': 'export declare const ambient: number;\n',
      'src/platform/leak.ts': "export { ambient } from '@/platform/ambient.js';\n",
      'src/platform/computed.ts':
        'export const load = (name: string): Promise<unknown> => import(`@/platform/${name}.js`);\n',
    });

    const before = emitted(root, '.js');
    const result = cli(root, 'build-aliases');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain(
      '3 alias specifier(s) of the compiled output cannot be rewritten; nothing was written',
    );

    expect(result.stderr).toContain(
      'dist/src/platform/leak.js, line 1: "@/platform/ambient.js" names no file the build emitted',
    );

    expect(result.stderr).toMatch(/dist\/src\/platform\/computed\.js, line 1: a dynamic import is given a template/);
    expect(emitted(root, '.js')).toEqual(before);
  });

  it('reads the output directory of the tsconfig it is given, and says so when nothing was compiled there', () => {
    const root = compiled();

    write(
      root,
      'tsconfig.other.json',
      JSON.stringify({ extends: './tsconfig.json', compilerOptions: { outDir: 'out' } }),
    );

    const missing = cli(root, 'build-aliases', '--project', 'tsconfig.other.json');

    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('tsconfig.other.json names no output directory that exists.');
    expect(cli(root, 'build-aliases', '--project', 'tsconfig.absent.json').code).toBe(2);

    execFileSync(process.execPath, [NATIVE_COMPILER, '-p', 'tsconfig.other.json'], { cwd: root, stdio: 'pipe' });

    expect(cli(root, 'build-aliases', '--project', 'tsconfig.other.json', '--json').json()).toMatchObject({
      outDir: 'out',
    });

    expect(read(root, 'out/src/main.js')).toContain("from './platform/place.js';");
    expect(walk(root, 'out').length).toBeGreaterThan(10);
  });

  it('follows a renamed alias and a source root that is the root of the build', () => {
    const root = tempDir('build-aliases');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ importAlias: '$app/', contexts: {} }));
    write(root, 'tsconfig.build.json', JSON.stringify({ compilerOptions: { rootDir: 'src', outDir: 'lib' } }));
    write(root, 'lib/main.js', "import { a } from '$app/deep/a.js';\nimport '@/kept.js';\n");
    write(root, 'lib/deep/a.js', 'export const a = 1;\n');
    write(root, 'lib/deep/index.js', "export { a as b } from '$app/deep/a.js';\n");
    write(root, 'lib/types.d.ts', "export type { A } from '$app/only-declared.js';\n");
    write(root, 'lib/only-declared.d.ts', 'export type A = 1;\n');

    expect(cli(root, 'build-aliases').code).toBe(0);
    expect(read(root, 'lib/main.js')).toBe("import { a } from './deep/a.js';\nimport '@/kept.js';\n");
    expect(read(root, 'lib/deep/index.js')).toBe("export { a as b } from './a.js';\n");
    expect(read(root, 'lib/types.d.ts')).toBe("export type { A } from './only-declared.js';\n");
  });
});

const BARE_SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SOURCES).map(([file, content]) => [file, content.replaceAll(".js'", "'")]),
);

const BARE = {
  'ddd-ts-kit.config.json': JSON.stringify({ importExtension: 'none', contexts: {} }),
  'tsconfig.json': TSCONFIG.replaceAll('"NodeNext"', '"ESNext"').replace(
    '"moduleResolution":"ESNext"',
    '"moduleResolution":"Bundler"',
  ),
  ...BARE_SOURCES,
};

describe('ddd-ts-kit build-aliases, in a project that writes its imports without an extension', () => {
  it('compiles under the bundler resolution, stops under plain node until the rewrite, then runs: the rewrite writes the ".js" Node needs', () => {
    const root = compiled(BARE);
    const before = node(root, 'dist/src/main.js');

    expect(read(root, 'src/main.ts')).toContain("from '@/platform/place';");
    expect(read(root, 'dist/src/main.js')).toContain("from '@/platform/place';");
    expect(before.status).not.toBe(0);
    expect(before.output).toMatch(/ERR_MODULE_NOT_FOUND|Cannot find package '@\//);

    expect(cli(root, 'build-aliases', '--json').json()).toEqual({
      outDir: 'dist',
      files: 10,
      changed: 5,
      specifiers: 8,
    });

    expect(node(root, 'dist/src/main.js')).toEqual({ status: 0, output: 'hello world later\n\n' });
    expect(node(root, 'dist/scripts/print.js')).toEqual({ status: 0, output: 'hello script\n\n' });
    expect(cli(root, 'build-aliases', '--json').json()).toMatchObject({ changed: 0, specifiers: 0 });
  });

  it('writes the full relative path with ".js" for a static import, a dynamic one, a type import and typeof import() of a declaration', () => {
    const root = compiled(BARE);

    cli(root, 'build-aliases');

    expect(read(root, 'dist/src/main.js')).toContain("from './contexts/billing/domain/greeting.js';");
    expect(read(root, 'dist/src/main.js')).toContain("await import('./platform/later.js')");
    expect(read(root, 'dist/src/contexts/billing/domain/greeting.js')).toContain("from '../../../platform/place.js';");
    expect(read(root, 'dist/src/platform/later.d.ts')).toContain("from '../contexts/billing/domain/greeting.js';");

    expect(read(root, 'dist/src/contexts/billing/domain/greeting.d.ts')).toMatch(
      /Promise<typeof import\(["']\.\.\/\.\.\/\.\.\/platform\/place\.js["']\)>/,
    );

    expect(Object.values({ ...emitted(root, '.js'), ...emitted(root, '.d.ts') }).join('\n')).not.toMatch(/['"]@\//);
  });

  it('never touches a package, whatever its subpath ends with: a look-alike of a file name is left as written', () => {
    const root = tempDir('build-aliases');

    const packages =
      "import 'zod/v4/core.js';\nimport '@scope/package/file.js';\nimport '@ddd-ts-kit/kernel/declarations';\nimport 'node:fs';\nimport '@scope/src/platform/place';\n";

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ importExtension: 'none', contexts: {} }));
    write(root, 'tsconfig.build.json', JSON.stringify({ compilerOptions: { rootDir: '.', outDir: 'dist' } }));
    write(root, 'dist/src/main.js', `${packages}import '@/platform/place';\n`);
    write(root, 'dist/src/platform/place.js', 'export {};\n');

    expect(cli(root, 'build-aliases', '--json').json()).toMatchObject({ changed: 1, specifiers: 1 });
    expect(read(root, 'dist/src/main.js')).toBe(`${packages}import './platform/place.js';\n`);
  });

  it('refuses a directory, an extension the config does not write, and a missing file, and says what to write instead', () => {
    const root = tempDir('build-aliases');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ importExtension: 'none', contexts: {} }));
    write(root, 'tsconfig.build.json', JSON.stringify({ compilerOptions: { rootDir: '.', outDir: 'dist' } }));

    write(
      root,
      'dist/src/main.js',
      "import '@/contexts/billing/published-language';\nimport '@/platform/place.js';\nimport '@/platform/absent';\n",
    );

    write(root, 'dist/src/contexts/billing/published-language/index.js', 'export {};\n');
    write(root, 'dist/src/platform/place.js', 'export {};\n');

    const before = read(root, 'dist/src/main.js');
    const result = cli(root, 'build-aliases');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain(
      'line 1: "@/contexts/billing/published-language" names a directory: an alias names one file, write "@/contexts/billing/published-language/index"',
    );

    expect(result.stderr).toContain(
      'line 2: "@/platform/place.js" has an extension although "importExtension" is "none": write "@/platform/place" (`eslint --fix` does)',
    );

    expect(result.stderr).toContain('line 3: "@/platform/absent" names no file the build emitted');
    expect(read(root, 'dist/src/main.js')).toBe(before);
  });

  it('refuses, in a project that writes ".js", an import without it and a directory: one spelling names a file', () => {
    const root = tempDir('build-aliases');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ importExtension: 'js', contexts: {} }));
    write(root, 'tsconfig.build.json', JSON.stringify({ compilerOptions: { rootDir: '.', outDir: 'dist' } }));
    write(root, 'dist/src/main.js', "import '@/platform/place';\nimport '@/platform';\n");
    write(root, 'dist/src/platform/place.js', 'export {};\n');
    write(root, 'dist/src/platform/index.js', 'export {};\n');

    const result = cli(root, 'build-aliases');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain(
      'line 1: "@/platform/place" has no extension although "importExtension" is "js": write "@/platform/place.js" (`eslint --fix` does)',
    );

    expect(result.stderr).toContain(
      'line 2: "@/platform" names a directory: an alias names one file, write "@/platform/index.js"',
    );
  });
});
