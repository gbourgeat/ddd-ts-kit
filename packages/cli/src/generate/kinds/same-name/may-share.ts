import { scan } from '../../../check/scan/scan';
import { workspaceSources } from './workspace-sources';
import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import type { Config } from '../../../config';
import type { Workspace } from '../../../workspace';
import type { IndexReading, StarModule } from './index-reading';
import type { Sources } from './sources-of';

/** A module a file exports names from: what it only imports, it exports under a name written in the file itself. */
const FROM = /\bexport\b[^;'"]*\bfrom\s*['"]([^'"]+)['"]/g;

/** How many files are read from one that is not read with certainty. */
const BOUND = 16;

/** A name a tables file exports as a value that something not read with certainty may export too, with the tables file to name it from. */
export interface MayBeShared {
  readonly name: string;
  /** The tables file that is not read when it is one, else the one that holds the value. */
  readonly context: string;
  /** The module the index names that tables file by. */
  readonly source: string;
}

/**
 * The values of the tables files that something not read with certainty may export too: each one
 * whose name is written, as a word of the code, comments and strings left out, in a file the index
 * re-exports whole that is not read, in a file of the project it takes names from, or in an
 * `export` of the index that is not read. Each comes with the
 * tables file a line by name would settle it from, the one that is not read when it is one, and
 * is left out once the index exports the name by name from that file. Nothing is decided on it: it only tells a reading that
 * hides nothing from one that may. What is no file of the project is not looked into.
 */
export function mayShare(ws: Workspace, config: Config, reading: IndexReading): MayBeShared[] {
  const sources = workspaceSources(ws, config);

  const blind: Blind[] = [
    ...reading.stars
      .filter(({ unread }) => unread.length > 0)
      .map((star) => ({ star, code: codeFrom(sources, star.file) })),
    { star: undefined, code: [...reading.doubts] },
  ];

  // A name the index already exports by name from a file is settled for that file, by hand or by an earlier run.
  const isListed = (file: string, name: string): boolean =>
    reading.given.some((given) => given.file === file && given.name === name);

  const held = reading.tables.flatMap((tables) =>
    tables.symbols.filter(({ kind }) => kind === 'value').map(({ name }) => ({ name, tables })),
  );

  const shared = held.flatMap(({ name, tables }) => {
    const word = new RegExp(`(?<![\\w$.])${escapeRegExp(name)}(?![\\w$])`);

    return blind
      .filter(({ star, code }) => star?.file !== tables.file && code.some((text) => word.test(text)))
      .map(({ star }) => ({ name, of: star?.context === undefined ? tables : { ...star, context: star.context } }));
  });

  const once = new Map(shared.map((one) => [`${one.of.file}#${one.name}`, one]));

  return [...once.values()]
    .filter(({ name, of }) => !isListed(of.file, name))
    .map(({ name, of }) => ({ name, context: of.context, source: of.source }));
}

/** Something not read with certainty: its code, and the file the index re-exports whole it is, if any. */
interface Blind {
  readonly star: StarModule | undefined;
  readonly code: readonly string[];
}

/** The code of a file and of every file of the project it takes names from, each once. */
function codeFrom(sources: Sources, start: string): string[] {
  const code: string[] = [];
  const seen = new Set<string>();
  const next = [start];

  while (next.length > 0 && seen.size < BOUND) {
    const file = next.shift() ?? '';
    const text = seen.has(file) ? undefined : sources.read(file);

    seen.add(file);

    if (text !== undefined) {
      code.push(scan(text).code);

      for (const [, source = ''] of text.matchAll(FROM)) {
        const resolved = sources.resolve(file, source);

        next.push(...(resolved.kind === 'file' ? [resolved.path] : []));
      }
    }
  }

  return code;
}
