import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export interface DecoratorsOptions {
  /**
   * The tsconfig whose `target`, `useDefineForClassFields`, `verbatimModuleSyntax` and
   * `experimentalDecorators` are followed. Default: for each file, the nearest `tsconfig.json`
   * above it, which is also the one the test runner follows.
   */
  readonly tsconfig?: string;
  /**
   * The package whose `tsc` compiles, resolved from the root of the project, or the path of a
   * `tsc` script. Default: `typescript`. Any version from 5.6 fits, the native one included.
   */
  readonly compiler?: string;
  /** Where compiled files are kept between runs. Default: `ddd-ts-kit-decorators` in the cache directory of Vite. */
  readonly cacheDir?: string;
}

/** The part of a Vite plugin this one fills: it is listed in `plugins` as it is. */
export interface DecoratorsPlugin {
  readonly name: string;
  readonly enforce: 'pre';
  configResolved(config: { readonly root: string; readonly cacheDir: string }): void;
  transform(code: string, id: string): { code: string; map: string } | undefined;
}

/**
 * Lets Vitest run TypeScript sources that hold standard (TC39) decorators, which its own
 * transform does not lower: a file holding one is compiled by the TypeScript compiler of the
 * project, with its compiler options and a source map, before the runner reads it. Every other
 * file is left to the runner, and so is every file of a project compiled with
 * `experimentalDecorators`: the runner lowers legacy decorators by itself.
 *
 *     // vitest.config.ts
 *     import { decorators } from '@ddd-ts-kit/testing/vitest';
 *     export default defineConfig({ plugins: [decorators()] });
 */
export function decorators(options: DecoratorsOptions = {}): DecoratorsPlugin {
  let compiler: DecoratorCompiler | undefined;
  return {
    name: 'ddd-ts-kit:decorators',
    enforce: 'pre',
    configResolved({ root, cacheDir }) {
      compiler = new DecoratorCompiler({
        script: compilerScript(options.compiler ?? 'typescript', root),
        cacheDir: options.cacheDir ?? path.join(cacheDir, 'ddd-ts-kit-decorators'),
        ...(options.tsconfig === undefined ? {} : { tsconfig: path.resolve(root, options.tsconfig) }),
      });
    },
    transform(code, id) {
      const file = id.replace(/[?#].*$/, '');
      if (compiler === undefined || !SOURCE.test(file) || DECLARATION.test(file) || !DECORATOR.test(code)) return undefined;
      return compiler.compile(file, code);
    },
  };
}

const SOURCE = /\.[cm]?ts$/;
const DECLARATION = /\.d\.[cm]?ts$/;
/** A line that starts with a decorator, after `export` or `export default` at most. */
const DECORATOR = /^[ \t]*(?:export\s+(?:default\s+)?)?@[A-Za-z_$]/m;

function compilerScript(compiler: string, root: string): string {
  if (path.isAbsolute(compiler) || compiler.startsWith('.')) return path.resolve(root, compiler);
  const manifestPath = createRequire(path.join(root, 'package.json')).resolve(`${compiler}/package.json`);
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = isRecord(manifest) && isRecord(manifest.bin) ? manifest.bin.tsc : undefined;
  if (typeof bin !== 'string') throw new Error(`The package "${compiler}" ships no tsc: name the compiler to use.`);
  return path.join(path.dirname(manifestPath), bin);
}

interface CompilerSetup {
  readonly script: string;
  readonly cacheDir: string;
  readonly tsconfig?: string;
}

/** What is taken from the project: the rest is fixed by what a single file needs. */
const FOLLOWED = ['target', 'useDefineForClassFields', 'verbatimModuleSyntax', 'experimentalDecorators', 'emitDecoratorMetadata'];

type ProjectOptions = Readonly<Record<string, unknown>>;

class DecoratorCompiler {
  readonly #projects = new Map<string, ProjectOptions>();

  constructor(private readonly setup: CompilerSetup) {}

  compile(file: string, code: string): { code: string; map: string } | undefined {
    const project = this.#projectOf(file);
    if (project.experimentalDecorators === true) return undefined;
    const entry = this.#entryOf(file, code, project);
    if (!existsSync(entry.output)) this.#emit({ ...entry, file }, code, project);
    return {
      code: readFileSync(entry.output, 'utf8').replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'),
      map: sourceMapOf(readFileSync(`${entry.output}.map`, 'utf8'), file, code),
    };
  }

  #projectOf(file: string): ProjectOptions {
    const tsconfig = this.setup.tsconfig ?? nearestTsconfig(path.dirname(file));
    if (tsconfig === undefined) return {};
    const known = this.#projects.get(tsconfig);
    if (known !== undefined) return known;
    const shown: unknown = JSON.parse(this.#run(['--showConfig', '-p', tsconfig], tsconfig));
    const all = isRecord(shown) && isRecord(shown.compilerOptions) ? shown.compilerOptions : {};
    const followed = Object.fromEntries(FOLLOWED.filter((name) => name in all).map((name) => [name, all[name]]));
    this.#projects.set(tsconfig, followed);
    return followed;
  }

  #entryOf(file: string, code: string, project: ProjectOptions): CacheEntry {
    const key = createHash('sha256')
      .update(JSON.stringify([FORMAT, this.setup.script, project, file, code]))
      .digest('hex')
      .slice(0, 32);
    const extension = path.extname(file);
    const directory = path.join(this.setup.cacheDir, key);
    return { directory, source: `source${extension}`, output: path.join(directory, `source${emittedExtension(extension)}`) };
  }

  /** Emitted next to the cache, then moved into it in one step: a reader never sees half a file. */
  #emit(entry: CacheEntry & { readonly file: string }, code: string, project: ProjectOptions): void {
    const workshop = `${entry.directory}.${process.pid}`;
    mkdirSync(workshop, { recursive: true });
    try {
      writeFileSync(path.join(workshop, entry.source), code);
      writeFileSync(path.join(workshop, 'tsconfig.json'), JSON.stringify(singleFileProject(entry.source, project)));
      this.#run(['-p', workshop], entry.file);
      if (!existsSync(entry.directory)) renameSync(workshop, entry.directory);
    } finally {
      rmSync(workshop, { recursive: true, force: true });
    }
  }

  #run(args: readonly string[], subject: string): string {
    try {
      return execFileSync(process.execPath, [this.setup.script, '--pretty', 'false', ...args], { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      throw new Error(`The TypeScript compiler refused ${subject}:\n${saidBy(error)}`, { cause: error });
    }
  }
}

function saidBy(failure: unknown): string {
  if (!isRecord(failure)) return String(failure);
  return [failure.stdout, failure.stderr].filter((output) => typeof output === 'string').join('');
}

/** Bumped when what is emitted for the same input changes. */
const FORMAT = 1;

interface CacheEntry {
  readonly directory: string;
  readonly source: string;
  readonly output: string;
}

function nearestTsconfig(directory: string): string | undefined {
  const candidate = path.join(directory, 'tsconfig.json');
  if (existsSync(candidate)) return candidate;
  const parent = path.dirname(directory);
  return parent === directory ? undefined : nearestTsconfig(parent);
}

function emittedExtension(extension: string): string {
  return extension.replace('ts', 'js');
}

/*
 * One file, no resolution and no type check: imports are kept as they are written, for the
 * runner to resolve. A target of `ESNext` would leave the decorators in place, which is what
 * this plugin exists to avoid, so the newest dated target stands in for it.
 */
function singleFileProject(source: string, project: ProjectOptions): unknown {
  const target = typeof project.target === 'string' ? project.target.toLowerCase() : 'es2022';
  return {
    compilerOptions: {
      ...project,
      target: target === 'esnext' ? 'es2024' : target,
      module: 'preserve',
      moduleResolution: 'bundler',
      noResolve: true,
      noCheck: true,
      isolatedModules: true,
      types: [],
      sourceMap: true,
      declaration: false,
      outDir: '.',
      rootDir: '.',
    },
    files: [source],
  };
}

/** The emitted map, naming the real file and holding its text, for stack traces and coverage. */
function sourceMapOf(emitted: string, file: string, code: string): string {
  const map: unknown = JSON.parse(emitted);
  const { mappings, names } = isRecord(map) ? map : {};
  return JSON.stringify({ version: 3, sources: [file], sourcesContent: [code], names: names ?? [], mappings: mappings ?? '' });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
