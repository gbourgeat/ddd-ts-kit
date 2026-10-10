import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isRecord } from './is-record.js';
import type { ProjectOptions } from './project-options.js';
import { singleFileProject } from './single-file-project.js';
import { sourceMapOf } from './source-map-of.js';

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

    if (!existsSync(entry.output)) {
      this.emit({ ...entry, file }, code, project);
    }

    return {
      code: readFileSync(entry.output, 'utf8').replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'),
      map: sourceMapOf(readFileSync(`${entry.output}.map`, 'utf8'), file, code),
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

  /** Emitted next to the cache, then moved into it in one step: a reader never sees half a file. */
  private emit(entry: CacheEntry & { readonly file: string }, code: string, project: ProjectOptions): void {
    const workshop = `${entry.directory}.${process.pid}`;

    mkdirSync(workshop, { recursive: true });

    try {
      writeFileSync(path.join(workshop, entry.source), code);
      writeFileSync(path.join(workshop, 'tsconfig.json'), JSON.stringify(singleFileProject(entry.source, project)));
      this.run(['-p', workshop], entry.file);

      if (!existsSync(entry.directory)) {
        renameSync(workshop, entry.directory);
      }
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
  if (!isRecord(failure)) {
    return String(failure);
  }

  return [failure.stdout, failure.stderr].filter((output) => typeof output === 'string').join('');
}
