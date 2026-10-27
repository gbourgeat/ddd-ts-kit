import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import { PRISMA_SCHEMA, prismaBlocks, schemaAt, schemaOfContext } from '../prisma-schema';
import type { ChangedEntry } from './changed-entry';
import type { SliceToVerify } from './slice-to-verify';

/** A file changed since `HEAD`: its lines before and after, the indexes of those removed (before) and of those added (after). */
interface ChangedFile {
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly removed: readonly number[];
  readonly added: readonly number[];
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const SCHEMAS = /^\s*schemas\s*=\s*\[([^\]]*)\]/;

/**
 * The shared files of the storage that `generate` wrote for the slice of `context`: the
 * `prisma/schema.prisma` of a Prisma project and the schema index of the platform
 * (`<platformDir>/database/schema.ts`) of the other ORMs, each when every line changed since
 * `HEAD` belongs to the context. In the schema of Prisma, a line of a model, an enum or a view of
 * its database schema, and that schema joining the `schemas` of the datasource; in the schema
 * index, a line that names the tables file of the context or what it is imported as. A file that
 * holds a change of another context, or of the platform, stays left out: a person decides about it.
 */
export function storageOfSlice(
  { root, config, context }: Omit<SliceToVerify, 'since'>,
  entries: readonly ChangedEntry[],
): Set<string> {
  const index = `${config.platformDir}/database/schema.ts`;

  const owned = (file: string): boolean =>
    file === PRISMA_SCHEMA
      ? ofTheContextInPrisma(schemaOfContext(context), changedFile(root, file))
      : ofTheContextInIndex(context, changedFile(root, file));

  return new Set(
    entries
      .filter((entry) => entry.tracked && (entry.path === PRISMA_SCHEMA || entry.path === index))
      .map((entry) => entry.path)
      .filter(owned),
  );
}

/** Every changed line is blank, of a block of the schema, or the `schemas` of the datasource that the schema joins. */
function ofTheContextInPrisma(schema: string, { before, after, removed, added }: ChangedFile): boolean {
  const ofTheSchema = (lines: readonly string[], changed: readonly number[]): boolean => {
    const blocks = prismaBlocks(lines);

    return changed.every((at) => {
      const line = lines[at] ?? '';

      return line.trim() === '' || SCHEMAS.test(line) || schemaAt(blocks, at) === schema;
    });
  };

  const was = schemasListed(before, removed);
  const is = schemasListed(after, added);
  const joined = [...was].every((name) => is.has(name)) && [...is].every((name) => name === schema || was.has(name));

  return ofTheSchema(before, removed) && ofTheSchema(after, added) && joined;
}

/** The database schemas the changed `schemas = [...]` line of the datasource lists. */
function schemasListed(lines: readonly string[], changed: readonly number[]): Set<string> {
  return new Set(
    changed.flatMap((at) =>
      [...(SCHEMAS.exec(lines[at] ?? '')?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(([, name]) => name ?? ''),
    ),
  );
}

/** Every changed line is blank, imports the tables file of the context, or names what it imports from there. */
function ofTheContextInIndex(context: string, { before, after, removed, added }: ChangedFile): boolean {
  const tablesFile = new RegExp(`/(?:${context}|create-${context}-tables)\\.schema(?:\\.js)?['"]`);

  const names = after
    .filter((line) => tablesFile.test(line))
    .flatMap((line) => (/\{([^}]*)\}/.exec(line)?.[1] ?? '').split(','))
    .map((name) => name.replace(/^\s*type\s+/, '').trim())
    .filter((name) => name !== '');

  const ofTheContext = (line: string): boolean =>
    line.trim() === '' || tablesFile.test(line) || names.some((name) => new RegExp(`\\b${name}\\b`).test(line));

  return removed.every((at) => ofTheContext(before[at] ?? '')) && added.every((at) => ofTheContext(after[at] ?? ''));
}

/** The file at `HEAD` and on disk, and its changed lines from `git diff --unified=0 HEAD`, one hunk header per change. */
function changedFile(root: string, file: string): ChangedFile {
  const diff = runGit(root, ['diff', '--no-color', '--no-ext-diff', '--unified=0', 'HEAD', '--', file]) ?? '';

  const hunks = diff.split('\n').flatMap((line) => {
    const hunk = HUNK.exec(line);

    return hunk === null ? [] : [hunk];
  });

  // A count git leaves out is 1; a count of 0 starts at the line before, and covers none.
  return {
    before: (runGit(root, ['show', `HEAD:./${file}`]) ?? '').split('\n'),
    after: readIfPresent(path.join(root, file)).split('\n'),
    removed: hunks.flatMap(([, start = '1', count = '1']) => range(Number(start) - 1, Number(count))),
    added: hunks.flatMap(([, , , start = '1', count = '1']) => range(Number(start) - 1, Number(count))),
  };
}

function range(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, offset) => start + offset);
}

function readIfPresent(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
