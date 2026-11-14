import fs from 'node:fs';
import { workspaceSources } from '../generate/kinds/same-name/workspace-sources';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import { isRecord } from '../check/support/is-record';
import { CONFIG_FILE, type Config } from '../config';
import { contextOfSource } from '../generate/kinds/same-name/context-of-source';
import { readTablesFile } from '../generate/kinds/same-name/read-tables-file';
import { tablesFileOf } from '../generate/kinds/same-name/tables-file-of';
import { isSourceOfContext, namedBindingsOf } from '../migration';
import { PRISMA_MAIN_SCHEMA, schemaOfContext } from '../prisma-schema';
import { Workspace } from '../workspace';
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
/** The line that opens a statement that imports names, or exports names or a whole module, from another. */
const STATEMENT = /^\s*(?:import|export)\s+(?:type\s+)?[{*]/;

const SCHEMAS = /^\s*schemas\s*=\s*\[([^\]]*)\]/;

/**
 * The shared files of the storage that `generate` wrote for the slice of `context`: the main file
 * of the Prisma schema (`prisma/schema/schema.prisma`), the schema index of the platform
 * (`<platformDir>/database/schema.ts`) of the other ORMs and the list of the read model tables the
 * application checks when it starts (`<platformDir>/database/read-model-tables.ts`), each when
 * every line changed since `HEAD` belongs to the context. In the main Prisma file, the database
 * schema of the context joining the `schemas` of the datasource, its models being in the file of
 * the context (`prisma/schema/<context>.prisma`, in the slice already); in the schema index, a
 * statement that names the tables file of the context or the entry of what it imports from it; in the list, the
 * import of a store of the context and its entry. A file that holds a change of another context,
 * or of the platform, stays left out: a person decides about it. So does a list that names a
 * context the committed configuration does not hold yet: it waits for that configuration.
 */
export function storageOfSlice(
  { root, config, context }: Omit<SliceToVerify, 'since' | 'sinceCommit'>,
  entries: readonly ChangedEntry[],
): Set<string> {
  const index = `${config.platformDir}/database/schema.ts`;
  const list = `${config.platformDir}/database/read-model-tables.ts`;

  const owned: Readonly<Record<string, (changed: ChangedFile) => boolean>> = {
    [PRISMA_MAIN_SCHEMA]: (changed) => ofTheContextInPrisma(schemaOfContext(context), changed),
    [index]: (changed) => ofTheContextInIndex({ root, config, context }, changed),
    [list]: (changed) => ofTheContextInList({ root, config, context, list }, changed),
  };

  return new Set(
    entries
      .filter((entry) => entry.tracked)
      .map((entry) => entry.path)
      .filter((file) => owned[file]?.(changedFile(root, file)) === true),
  );
}

/** The list of the read model tables of a project, read for the slice of a context. */
interface ListOfSlice {
  readonly root: string;
  readonly config: Config;
  readonly context: string;
  /** The list, from the project root. */
  readonly list: string;
}

const ENTRY = /^\[(['"])([^'"]*)\1, ([\w$]+)\],?$/;
const IMPORT_END = /\bfrom\s*(['"])([^'"]+)\1;?$/;

/**
 * Every changed line of the list of the read model tables is blank, belongs to the import of a
 * store from the context, is the entry of such a store under the context, `['<context>', <Store>],`,
 * or names the context among those an entry may bear. A line is read in the version that holds
 * it: one the slice removed against the file as it was, so that the read model a slice takes away
 * leaves the list with it. An import is read by the module it names, never by a name it holds: the
 * store of the same name of another context, imported under an alias, is the line of that context.
 */
function ofTheContextInList(slice: ListOfSlice, { before, after, removed, added }: ChangedFile): boolean {
  const was = linesOfTheContext(slice, before);
  const is = linesOfTheContext(slice, after);

  return removed.every((at) => was(at)) && added.every((at) => is(at));
}

/** Answers, for one version of the list, whether the line at an index is of the context. */
function linesOfTheContext(slice: ListOfSlice, lines: readonly string[]): (at: number) => boolean {
  const { config, context, list } = slice;
  const imports = new Set<number>();
  const stores = new Set<string>();
  let opened: number | undefined;

  lines.forEach((line, at) => {
    opened ??= /^\s*import\b/.test(line) ? at : undefined;

    const source = opened === undefined ? undefined : IMPORT_END.exec(line.trim())?.[2];

    if (opened !== undefined && source !== undefined) {
      if (isSourceOfContext(config, { from: list, source, context })) {
        const statement = lines.slice(opened, at + 1);

        statement.forEach((_line, offset) => imports.add((opened ?? at) + offset));

        namedBindingsOf(statement.join('\n'), 'import').forEach(({ names }) => {
          names.forEach(({ local }) => stores.add(local));
        });
      }

      opened = undefined;
    }
  });

  return (at) => {
    const line = (lines[at] ?? '').trim();
    const [, , ofContext, store = ''] = ENTRY.exec(line) ?? [];

    return (
      line === '' ||
      imports.has(at) ||
      (ofContext === context && stores.has(store)) ||
      (line === `'${context}',` && isCommitted(slice))
    );
  };
}

/**
 * Whether the configuration git holds declares the context. The configuration is never staged with
 * a slice: a list that names a context created since, staged alone, would be committed ahead of
 * the configuration it is checked against, so it waits with it.
 */
function isCommitted({ root, context }: ListOfSlice): boolean {
  try {
    const committed: unknown = JSON.parse(runGit(root, ['show', `HEAD:./${CONFIG_FILE}`]) ?? '');

    return isRecord(committed) && isRecord(committed['contexts']) && Object.hasOwn(committed['contexts'], context);
  } catch {
    return false;
  }
}

/** Every changed line is blank or the `schemas` of the datasource, which the schema of the context joins and nothing else. */
function ofTheContextInPrisma(schema: string, { before, after, removed, added }: ChangedFile): boolean {
  const joinsOnly = (lines: readonly string[], changed: readonly number[]): boolean =>
    changed.every((at) => {
      const line = lines[at] ?? '';

      return line.trim() === '' || SCHEMAS.test(line);
    });

  const was = schemasListed(before, removed);
  const is = schemasListed(after, added);
  const joined = [...was].every((name) => is.has(name)) && [...is].every((name) => name === schema || was.has(name));

  return joinsOnly(before, removed) && joinsOnly(after, added) && joined;
}

/** The database schemas the changed `schemas = [...]` line of the datasource lists. */
function schemasListed(lines: readonly string[], changed: readonly number[]): Set<string> {
  return new Set(
    changed.flatMap((at) =>
      [...(SCHEMAS.exec(lines[at] ?? '')?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(([, name]) => name ?? ''),
    ),
  );
}

/** The entry of a name the index imports: an entity it lists, `shippingOrders,`, or the tables it creates, `await createShippingTables(knex);`. */
const ENTRY_OF = /^(?:await\s+)?([\w$]+)(?:\(\w*\);|,)$/;
/** A name exported from a module as it is, the line that lets one tables file keep a name several hold. */
const KEPT = /^export (?:type )?\{ ([\w$]+) \} from '([^']+)';$/;

/**
 * Every changed line is blank, belongs to a statement that imports or exports from the tables file
 * of the context, is the entry of a name such a statement imports, or is the line that lets another
 * tables file keep a name the context exports under an alias, written with that alias when the
 * context came to hold a table of the same name. A line is of the context by the module its
 * statement names, never by a word it holds: a line of the platform that reads a table of the
 * context is a line of the platform. Each line is read in the version that holds it, and a
 * statement written on several lines is read whole.
 */
function ofTheContextInIndex(slice: IndexOfSlice, { before, after, removed, added }: ChangedFile): boolean {
  const was = indexLinesOfTheContext(slice, before);
  const is = indexLinesOfTheContext(slice, after);

  return removed.every((at) => was(at)) && added.every((at) => is(at));
}

/** The schema index of a project, read for the slice of a context. */
interface IndexOfSlice {
  readonly root: string;
  readonly config: Config;
  readonly context: string;
}

/** Answers, for one version of the schema index, whether the line at an index is of the context. */
function indexLinesOfTheContext(slice: IndexOfSlice, lines: readonly string[]): (at: number) => boolean {
  const { config, context } = slice;
  const index = `${config.platformDir}/database/schema.ts`;
  const isOfTheContext = (source: string): boolean => isSourceOfContext(config, { from: index, source, context });
  const statements = new Set<number>();
  const imported = new Set<string>();
  const aliased = new Set<string>();
  let opened: number | undefined;

  lines.forEach((line, at) => {
    opened ??= STATEMENT.test(line) ? at : undefined;

    const source = opened === undefined ? undefined : IMPORT_END.exec(line.trim())?.[2];

    if (opened !== undefined && source !== undefined && isOfTheContext(source)) {
      const statement = lines.slice(opened, at + 1);
      const text = statement.join('\n');

      statement.forEach((_line, offset) => statements.add((opened ?? at) + offset));
      namedBindingsOf(text, 'import').forEach(({ names }) => names.forEach(({ local }) => imported.add(local)));

      namedBindingsOf(text, 'export').forEach(({ names }) =>
        names.filter(({ name, local }) => name !== local).forEach(({ name }) => aliased.add(name)),
      );
    }

    opened = source !== undefined || line.trim().endsWith(';') ? undefined : opened;
  });

  return (at) => {
    const line = (lines[at] ?? '').trim();

    return (
      line === '' ||
      statements.has(at) ||
      imported.has(ENTRY_OF.exec(line)?.[1] ?? '') ||
      isKeptFor(slice, aliased, line)
    );
  };
}

/** Whether a line lets the tables file of another context keep a name it holds, one the context of the slice exports under an alias. */
function isKeptFor(slice: IndexOfSlice, aliased: ReadonlySet<string>, line: string): boolean {
  const [, name = '', source = ''] = KEPT.exec(line) ?? [];

  return aliased.has(name) && holds(slice, source, name);
}

/** Whether a module is the tables file of a context of the project that exports this name. */
function holds({ root, config }: IndexOfSlice, source: string, name: string): boolean {
  const ws = new Workspace(root, false);
  const context = contextOfSource(ws, config, source);
  const sources = workspaceSources(ws, config);

  return (
    context !== undefined &&
    readTablesFile(sources, tablesFileOf(ws, config, context)).symbols.some((symbol) => symbol.name === name)
  );
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
