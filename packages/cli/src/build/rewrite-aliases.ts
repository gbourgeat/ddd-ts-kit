import fs from 'node:fs';
import path from 'node:path';
import type { AliasRoot } from '../alias/index.js';
import { buildLayoutOf } from '../check/alias/build-layout-of.js';
import { walkDirectory } from '../check/project/walk-directory.js';
import { CliError } from '../cli-error.js';
import type { EmittedPlace } from './emitted-place.js';
import { emittedSpecifier } from './emitted-specifier.js';
import type { RewriteReport } from './rewrite-report.js';
import { rewriteSpecifiers } from './rewrite-specifiers.js';

const EMITTED = /\.(?:[cm]?js|d\.[cm]?ts)$/;
const SHOWN = 20;

export interface RewriteRequest {
  readonly root: string;
  readonly roots: readonly AliasRoot[];
  /** The tsconfig the build compiled with, from the project root. */
  readonly project: string;
}

/**
 * Rewrites, under the output directory of a build, every alias specifier of the emitted
 * JavaScript and declaration files into the relative path of the emitted file it names, so that
 * plain `node` runs the output. Nothing is written when one specifier cannot be rewritten.
 */
export function rewriteAliases({ root, roots, project }: RewriteRequest): RewriteReport {
  const layout = buildLayoutOf({ root }, project);

  if (layout === undefined || !isDirectory(path.join(root, layout.outDir))) {
    throw new CliError(
      `${project} names no output directory that exists.`,
      'Compile first (`npm run build` chains the compiler and this command), or name the tsconfig of the build with --project.',
    );
  }

  const place: EmittedPlace = { roots, layout, isFile: (file) => isFile(path.join(root, file)) };
  const files = emittedUnder(root, layout.outDir);
  const prefixes = roots.map(({ prefix }) => prefix);

  const rewritten = files.map((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const relativeOf = (specifier: string): string | undefined => emittedSpecifier(place, file, specifier);

    return { file, source, ...rewriteSpecifiers(source, { prefixes, relativeOf }) };
  });

  refuse(rewritten.flatMap(({ file, problems }) => problems.map((problem) => `${file}, ${problem}`)));

  const changed = rewritten.filter(({ source, text }) => text !== source);

  changed.forEach(({ file, text }) => fs.writeFileSync(path.join(root, file), text));

  return {
    outDir: layout.outDir,
    files: files.length,
    changed: changed.length,
    specifiers: changed.reduce((sum, { count }) => sum + count, 0),
  };
}

function refuse(problems: readonly string[]): void {
  if (problems.length === 0) {
    return;
  }

  const more = problems.length > SHOWN ? `\n  and ${problems.length - SHOWN} more` : '';

  throw new CliError(
    `${problems.length} alias specifier(s) of the compiled output cannot be rewritten; nothing was written:\n  ${problems.slice(0, SHOWN).join('\n  ')}${more}`,
    'Import a file the build emits, and give `import()` a string literal: an alias completed at run time names a file only Node could look for, and Node does not know the alias.',
  );
}

function emittedUnder(root: string, outDir: string): string[] {
  const files: string[] = [];

  walkDirectory(root, outDir, (file, isDirectoryEntry) => {
    if (!isDirectoryEntry && EMITTED.test(file)) {
      files.push(file);
    }
  });

  return files;
}

function isFile(file: string): boolean {
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true;
}

function isDirectory(file: string): boolean {
  return fs.statSync(file, { throwIfNoEntry: false })?.isDirectory() === true;
}
