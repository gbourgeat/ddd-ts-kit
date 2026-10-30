import fs from 'node:fs';
import path from 'node:path';
import type { AliasRoot } from '../alias';
import { buildLayoutOf } from '../check/alias/build-layout-of';
import { walkDirectory } from '../check/project/walk-directory';
import { CliError } from '../cli-error';
import type { EmittedPlace } from './emitted-place';
import { emittedSpecifier } from './emitted-specifier';
import type { RewriteReport } from './rewrite-report';
import { rewriteSpecifiers } from './rewrite-specifiers';
import { unresolvedProblem } from './unresolved-problem';

const EMITTED = /\.(?:[cm]?js|d\.[cm]?ts)$/;
const SHOWN = 20;

export interface RewriteRequest {
  readonly root: string;
  readonly roots: readonly AliasRoot[];
  /** What an alias specifier ends with in the sources: `.js`, or nothing. */
  readonly suffix: string;
  /** The tsconfig the build compiled with, from the project root. */
  readonly project: string;
}

/**
 * Rewrites, under the output directory of a build, every alias specifier of the emitted
 * JavaScript and declaration files into the relative path of the emitted file it names, with its
 * `.js` extension whether or not the sources write one, so that plain `node` runs the output. Nothing is written when one specifier cannot be rewritten.
 */
export function rewriteAliases({ root, roots, suffix, project }: RewriteRequest): RewriteReport {
  const layout = buildLayoutOf({ root }, project);

  if (layout === undefined || !isDirectory(path.join(root, layout.outDir))) {
    throw noOutput(project);
  }

  const place: EmittedPlace = { layout, suffix, isFile: (file) => isFile(path.join(root, file)) };
  const files = emittedUnder(root, layout.outDir);

  const problemOf = (specifier: string, alias: AliasRoot): string => unresolvedProblem(place, alias, specifier);

  const rewritten = files.map((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');

    const relativeOf = (specifier: string, alias: AliasRoot): string | undefined =>
      emittedSpecifier(place, file, { root: alias, specifier });

    return { file, source, ...rewriteSpecifiers(source, { roots, relativeOf, problemOf }) };
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

function noOutput(project: string): CliError {
  return new CliError(
    `${project} names no output directory that exists.`,
    'Compile first (`npm run build` chains the compiler and this command), or name the tsconfig of the build with --project.',
  );
}

function refuse(problems: readonly string[]): void {
  if (problems.length === 0) {
    return;
  }

  const more = problems.length > SHOWN ? `\n  and ${problems.length - SHOWN} more` : '';

  throw new CliError(
    `${problems.length} alias specifier(s) of the compiled output cannot be rewritten; nothing was written:\n  ${problems.slice(0, SHOWN).join('\n  ')}${more}`,
    'Import a file the build emits, by its path with the ending "importExtension" asks for, and give `import()` a string literal: an alias completed at run time names a file only Node could look for, and Node does not know the alias.',
  );
}

function emittedUnder(root: string, outDir: string): string[] {
  const files: string[] = [];

  walkDirectory({ root, directory: outDir }, (file, isDirectoryEntry) => {
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
