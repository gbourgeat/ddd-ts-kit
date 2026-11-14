import type { Config } from '../../../config';
import { readModule } from './read-module';
import { type ExportedSymbol, readTablesFile } from './read-tables-file';
import { type FileReader, type Sources, sourcesOf } from './sources-of';

/** A file of the project the index re-exports whole: the tables file of a context, or another module, read for what it is. */
export interface StarModule {
  /** The context whose tables file it is; undefined for any other file of the project. */
  readonly context: string | undefined;
  /** The module as the index names it. */
  readonly source: string;
  /** The file, from the project root. */
  readonly file: string;
  /** What it exports, each with the place that declares it. */
  readonly symbols: readonly ExportedSymbol[];
  /** Why the file is not read with certainty; empty when it is. */
  readonly unread: readonly string[];
}

/** The tables file of a context the index re-exports whole. */
interface TablesOfContext extends StarModule {
  readonly context: string;
}

/** A name the index exports by name from a module, with what it is there. */
interface GivenName {
  /** The name the index exports. */
  readonly local: string;
  /** The name the module calls it. */
  readonly name: string;
  /** The module, as the index names it. */
  readonly source: string;
  /** The file of the project it comes from; undefined for a package. */
  readonly file: string | undefined;
  /** The origin of its value, when the line exports one. */
  readonly value?: string;
  /** The origin of its type. */
  readonly type?: string;
}

/** The schema index of a Drizzle project and the files it re-exports, as far as they are read with certainty. */
export interface IndexReading {
  /** The index, from the project root. */
  readonly index: string;
  readonly text: string;
  /** The names the index declares itself, as values. */
  readonly values: readonly string[];
  /** The names it declares itself, as types. */
  readonly types: readonly string[];
  /** The names it exports from a module by name. */
  readonly given: readonly GivenName[];
  /** The files of the project it re-exports whole, in its order, each once. */
  readonly stars: readonly StarModule[];
  /** Those of `stars` that are the tables file of a context. */
  readonly tables: readonly TablesOfContext[];
  /** The code of each `export` of the index that is not read. */
  readonly doubts: readonly string[];
  /** Why the index, or a file it re-exports, is not read with certainty; empty when all of it is. */
  readonly unread: readonly string[];
}

/** Where the index and the tables files are read. */
export interface IndexSource {
  /** The index, from the project root. */
  readonly index: string;
  readonly read: FileReader;
  /** The tables file of a context, from the project root. */
  readonly tablesFile: (context: string) => string;
  /** The path a file is read at, in the module of the model that holds it. */
  readonly place?: (file: string) => string;
}

/**
 * Reads the schema index and every file of the project it re-exports whole or takes names from,
 * each specifier resolved the one way (`sourcesOf`). A module it re-exports whole is the tables
 * file of a context when it resolves to that file, whatever it is called and however it is named;
 * any other file of the project is read for what it is, and its exports take part under their own
 * origin. A package re-exported whole, a specifier that resolves to nothing, and any export the
 * reader does not answer for, in the index or in a file it reads, make the reading uncertain. A
 * file the index re-exports twice is read once.
 */
export function readIndex(config: Config, { index, read, tablesFile, place }: IndexSource): IndexReading {
  const sources = sourcesOf(config, read, place);
  const text = read(index) ?? '';
  const own = readModule(text);
  const contexts = new Map(Object.keys(config.contexts).map((context) => [tablesFile(context), context]));
  const whole = [...new Set(own.whole)].map((source) => starOf(sources, { index, source, contexts }));
  const stars = whole.flatMap((star) => ('file' in star ? [star] : []));
  const files = new Map<string, StarModule>();

  // A file two specifiers of the index name, an alias and a relative path, is one file.
  for (const star of stars) {
    files.set(star.file, files.get(star.file) ?? star);
  }

  const given = own.named.flatMap(({ source, names }) =>
    names.map((taken) => givenBy(sources, { index, source, ...taken })),
  );

  return {
    index,
    text,
    values: own.values,
    types: own.types,
    given,
    stars: [...files.values()],
    tables: [...files.values()].filter((star): star is TablesOfContext => star.context !== undefined),
    doubts: own.doubts,
    unread: [
      ...new Set([
        ...own.unread.map((what) => `${index}, ${what}`),
        ...whole.flatMap(({ unread }) => unread),
        ...given.flatMap((one) => one.unread ?? []),
      ]),
    ],
  };
}

/** A module the index re-exports whole, and the tables files of the contexts by their path. */
interface Star {
  readonly index: string;
  readonly source: string;
  readonly contexts: ReadonlyMap<string, string>;
}

function starOf(sources: Sources, { index, source, contexts }: Star): StarModule | { unread: string[] } {
  const resolved = sources.resolve(index, source);

  if (resolved.kind !== 'file') {
    return { unread: [`${index}, which re-exports '${source}', a module the kit does not follow`] };
  }

  return {
    context: contexts.get(resolved.path),
    source,
    file: resolved.path,
    ...readTablesFile(sources, resolved.path),
  };
}

/** One name the index takes from a module by name. */
interface Taken {
  readonly index: string;
  readonly source: string;
  readonly name: string;
  readonly local: string;
  readonly isType: boolean;
}

/** What a name the index exports by name is: read in the file it comes from, or that name of a package. */
function givenBy(sources: Sources, { index, source, name, local, isType }: Taken): GivenName & { unread?: string[] } {
  const resolved = sources.resolve(index, source);

  // A module the kit does not read: the name and its kind are written here, and the module is the place of what it names.
  if (resolved.kind !== 'file') {
    const origin = `${resolved.kind === 'package' ? resolved.name : source}#${name}`;

    return { local, name, source, file: undefined, type: origin, ...(isType ? {} : { value: origin }) };
  }

  return givenByFile(sources, { index, source, name, local, isType }, resolved.path);
}

/** A name the index takes from a file of the project: what that file exports under it, or why it is not read. */
function givenByFile(
  sources: Sources,
  { index, source, name, local, isType }: Taken,
  file: string,
): GivenName & { unread?: string[] } {
  const { symbols, unread } = readTablesFile(sources, file);

  const origin = (kind: 'value' | 'type'): string | undefined =>
    symbols.find((symbol) => symbol.name === name && symbol.kind === kind)?.origin;

  const value = origin('value');
  const type = origin('type') ?? value;
  const unknown = `${index}, which exports \`${name}\` from '${source}', where the kit does not read what it is`;
  const why = unread.length > 0 ? [...unread] : type === undefined ? [unknown] : [];

  return {
    local,
    name,
    source,
    file,
    ...(isType || value === undefined ? {} : { value }),
    ...(type === undefined ? {} : { type }),
    ...(why.length > 0 ? { unread: why } : {}),
  };
}
