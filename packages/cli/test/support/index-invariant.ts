import { expect } from 'vitest';
import { cli, read, write } from '../helpers';
import { expectOk } from './expect-ok';
import { loadedIndex } from './index-tables';

export const INDEX = 'src/platform/database/schema.ts';
export const CONTEXTS = ['billing:core', 'shipping:supporting', 'returns:supporting'].flatMap((name) => [
  '--context',
  name,
]);

/** An aggregate of a context with its repository: what the two commands printed. */
export function store(root: string, context: string, aggregate: string): string {
  const term = `${aggregate}=What ${context} keeps`;
  const declared = expectOk(cli(root, 'generate', 'aggregate', context, aggregate, '--term', term));

  return `${declared.stdout}\n${expectOk(cli(root, 'generate', 'repository', context, aggregate)).stdout}`;
}

/** The lines of the index that export or import a name: those a settle writes, moves or removes. */
export function byNameLines(index: string): string[] {
  const statements = index.match(/^[ \t]*(?:export|import) (?:type )?\{[^}]*\} from '[^']+';$/gm) ?? [];

  return statements.map((line) => line.replace(/\s+/g, ' ').trim()).sort();
}

/** What a command may leave: the tables the index held before it, with those it brings. */
interface Expected {
  /** The lines by name of the index as the command would leave it without settling anything. */
  readonly unsettled: readonly string[];
  /** Every table the index must hold once the command settled it. */
  readonly tables: readonly string[];
  /** What the command printed. */
  readonly said: string;
  /** Whether every tables file is one the kit reads with certainty: the command then settles, and every table is there. */
  readonly readable: boolean;
}

/**
 * The invariant of every command that writes the schema index: either it settled nothing, the
 * lines by name being those the command leaves without a settle, or the index loads and holds
 * every table, each table of each tables file as the object it is. An index that lacks a table is one the command wrote no name in, and said so. With
 * tables files it reads with certainty, the command settles: every table is there.
 */
export async function expectNoTableLost(root: string, expected: Expected): Promise<void> {
  const { unsettled, tables, said, readable } = expected;
  const index = read(root, INDEX);
  const loaded = await loadedIndex(root);
  const wroteNothing = JSON.stringify(byNameLines(index)) === JSON.stringify([...unsettled].sort());
  const lacks = loaded.missing.some((table) => tables.includes(table));
  const isWhole = loaded.error === undefined && !lacks && loaded.twice.length === 0;
  const holdsAll = isWhole && tables.every((table) => loaded.tables.includes(table));

  // On TypeORM the kit tells two entities apart only by the tables files that declare them, and says so.
  const toldSo =
    said.includes('the kit wrote no name in it') || said.includes('the kit cannot tell the entities apart');

  expect({ holdsAll, wroteNothing, toldSo, loaded, index, said }).toMatchObject(
    readable || !wroteNothing ? { holdsAll: true } : { toldSo: holdsAll ? toldSo : true },
  );
}

/** The index of a project without the lines that settle a name: what a team that merged by hand, or a kit that settled nothing, leaves. */
export function unsettle(root: string): void {
  write(root, INDEX, read(root, INDEX).replace(/^export (?:type )?\{.*\n/gm, ''));
}
