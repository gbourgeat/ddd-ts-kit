import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isRecord } from './is-record';
import type { ProjectOptions } from './project-options';
import { singleFileProject } from './single-file-project';
import { sourceMapOf } from './source-map-of';

export interface CompilerSetup {
  readonly script: string;
  readonly cacheDir: string;
  readonly tsconfig?: string;
}

/** What is taken from the project: the rest is fixed by what a single file needs. */
const FOLLOWED = [
  'target',
  'useDefineForClassFields',
  'verbatimModuleSyntax',
  'experimentalDecorators',
  'emitDecoratorMetadata',
];

/** Bumped when what is emitted for the same input changes. */
const FORMAT = 1;

interface CacheEntry {
  readonly directory: string;
  readonly source: string;
  readonly output: string;
}

/** What `tsc` wrote for one file: the code and its source map, as text. */
interface Emitted {
  readonly code: string;
  readonly map: string;
}

/** Compiles one file holding standard decorators with the `tsc` of the project, once per content. */
export class DecoratorCompiler {
  private readonly projects = new Map<string, ProjectOptions>();

  constructor(private readonly setup: CompilerSetup) {}

  compile(file: string, code: string): { code: string; map: string } | undefined {
    const project = this.projectOf(file);

    if (project.experimentalDecorators === true) {
      return undefined;
    }

    const entry = this.entryOf(file, code, project);
    const emitted = isComplete(entry.output) ? emittedAt(entry.output) : this.emit({ ...entry, file }, code, project);

    return {
      code: emitted.code.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'),
      map: sourceMapOf(emitted.map, file, code),
    };
  }

  private projectOf(file: string): ProjectOptions {
    const tsconfig = this.setup.tsconfig ?? nearestTsconfig(path.dirname(file));

    if (tsconfig === undefined) {
      return {};
    }

    const known = this.projects.get(tsconfig);

    if (known !== undefined) {
      return known;
    }

    const shown: unknown = JSON.parse(this.run(['--showConfig', '-p', tsconfig], tsconfig));
    const all = isRecord(shown) && isRecord(shown.compilerOptions) ? shown.compilerOptions : {};
    const followed = Object.fromEntries(FOLLOWED.filter((name) => name in all).map((name) => [name, all[name]]));

    this.projects.set(tsconfig, followed);

    return followed;
  }

  private entryOf(file: string, code: string, project: ProjectOptions): CacheEntry {
    const key = createHash('sha256')
      .update(JSON.stringify([FORMAT, this.setup.script, project, file, code]))
      .digest('hex')
      .slice(0, 32);

    const extension = path.extname(file);
    const directory = path.join(this.setup.cacheDir, key);

    return {
      directory,
      source: `source${extension}`,
      output: path.join(directory, `source${emittedExtension(extension)}`),
    };
  }

  /**
   * Emitted next to the cache, read there, then moved into it in one step: a reader never sees half a
   * file, and what this call answers does not depend on the cache. An entry that lost its output or its
   * map is replaced, instead of failing every compile of its file.
   */
  private emit(entry: CacheEntry & { readonly file: string }, code: string, project: ProjectOptions): Emitted {
    const workshop = `${entry.directory}.${process.pid}`;

    mkdirSync(workshop, { recursive: true });

    try {
      writeFileSync(path.join(workshop, entry.source), code);
      writeFileSync(path.join(workshop, 'tsconfig.json'), JSON.stringify(singleFileProject(entry.source, project)));
      this.run(['-p', workshop], entry.file);

      const emitted = emittedAt(path.join(workshop, path.basename(entry.output)));

      if (existsSync(entry.directory) && !isComplete(entry.output)) {
        rmSync(entry.directory, { recursive: true, force: true });
      }

      if (!existsSync(entry.directory)) {
        renameSync(workshop, entry.directory);
      }

      return emitted;
    } finally {
      rmSync(workshop, { recursive: true, force: true });
    }
  }

  private run(args: readonly string[], subject: string): string {
    try {
      return execFileSync(process.execPath, [this.setup.script, '--pretty', 'false', ...args], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`The TypeScript compiler refused ${subject}:\n${saidBy(error)}`, { cause: error });
    }
  }
}

/** An entry of the cache holds the output and its map; one without them was damaged. */
function isComplete(output: string): boolean {
  return existsSync(output) && existsSync(`${output}.map`);
}

function emittedAt(output: string): Emitted {
  return { code: readFileSync(output, 'utf8'), map: readFileSync(`${output}.map`, 'utf8') };
}

function nearestTsconfig(directory: string): string | undefined {
  const candidate = path.join(directory, 'tsconfig.json');

  if (existsSync(candidate)) {
    return candidate;
  }

  const parent = path.dirname(directory);

  return parent === directory ? undefined : nearestTsconfig(parent);
}

function emittedExtension(extension: string): string {
  return extension.replace('ts', 'js');
}

function saidBy(failure: unknown): string {
  /* v8 ignore next 3 -- ADR-0001: the only caller catches what execFileSync throws, always an Error */
  if (!isRecord(failure)) {
    return String(failure);
  }

  return [failure.stdout, failure.stderr].filter((output) => typeof output === 'string').join('');
}
