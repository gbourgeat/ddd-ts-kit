import { type ReexportedNames, readModule } from './read-module';
import type { Sources } from './sources-of';

/**
 * One thing a file exports under a name: a value or a type, and where it is declared. Two exports
 * of one origin are one symbol, whatever the files that re-export it and however they name the
 * file: only different origins under one name are two tables of the same name.
 */
export interface ExportedSymbol {
  /** The name the file exports it under. */
  readonly name: string;
  readonly kind: 'value' | 'type';
  /** `<the path of the file that declares it, or the package>#<the name it bears there>`. */
  readonly origin: string;
  /** Whether the file read declares it itself, as the reader saw: never a name it takes from another module, found or not. */
  readonly declaredHere: boolean;
}

/** What a tables file exports, through the files it re-exports. */
export interface TablesFileExports {
  readonly symbols: readonly ExportedSymbol[];
  /** Why the file is not read with certainty, each reason with its file; empty when it is. */
  readonly unread: readonly string[];
}

/** How far a chain of re-exports is followed: past it, the file is not read. */
const DEPTH = 8;

/**
 * Everything a file exports, as the compiler sees it: what it declares, what it takes by name from
 * another module, and what the files of the project it re-exports whole export, each read once and
 * no deeper than a few files. Each export keeps the place that declares it. What the file declares
 * or takes by name wins over what a module re-exported whole brings under the same name, as in the
 * language; `default` is never brought. A name taken by name from a module the kit does not read
 * is a value unless written as a type. A module re-exported whole that is no file the kit finds, a file that is missing, two modules re-exported whole that bring different
 * things under one name (the file does not compile), or an export the reader does not answer for,
 * makes the whole file unread: `symbols` then holds what was read, and nothing may be decided on a
 * name it lacks.
 */
export function readTablesFile(
  sources: Sources,
  file: string,
  seen: ReadonlySet<string> = new Set(),
): TablesFileExports {
  const source = sources.read(file);

  if (source === undefined) {
    return { symbols: [], unread: [`${file} is missing`] };
  }

  const own = readModule(source);
  const visited = new Set([...seen, file]);
  const taken = own.named.map((names) => takenFrom(sources, { file, names, seen: visited }));
  const followed = own.whole.map((specifier) => reexported(sources, { file, specifier, seen: visited }));

  const declared =
    (kind: 'value' | 'type') =>
    (name: string): ExportedSymbol => ({ name, kind, origin: `${file}#${name}`, declaredHere: true });

  const local = [
    ...own.values.map(declared('value')),
    ...own.types.map(declared('type')),
    ...taken.flatMap(({ symbols }) => symbols),
  ].filter(({ name }) => name !== 'default');

  const brought = broughtBy(
    followed.map(({ symbols }) => symbols),
    new Set(local.map(({ name }) => name)),
  );

  return {
    symbols: [...local, ...brought.symbols],
    unread: [
      ...own.unread.map((what) => `${file}, ${what}`),
      ...brought.twice.map((name) => `${file}, which re-exports two modules that both export \`${name}\``),
      ...[...taken, ...followed].flatMap(({ unread }) => unread),
    ],
  };
}

/**
 * What the modules a file re-exports whole bring to it: each symbol once, those of a name the file
 * exports itself left out. A name two of them bring from different places is brought by neither.
 */
function broughtBy(
  stars: readonly (readonly ExportedSymbol[])[],
  shadowed: ReadonlySet<string>,
): { symbols: ExportedSymbol[]; twice: string[] } {
  const brought = new Map<string, ExportedSymbol>();
  const twice = new Set<string>();

  for (const symbol of stars.flat()) {
    const known = [...brought.values()].find(({ name, kind }) => name === symbol.name && kind === symbol.kind);

    if (known !== undefined && known.origin !== symbol.origin) {
      twice.add(symbol.name);
    }

    if (!shadowed.has(symbol.name) && symbol.name !== 'default') {
      brought.set(`${symbol.name} ${symbol.kind} ${symbol.origin}`, symbol);
    }
  }

  const conflicting = [...twice].filter((name) => !shadowed.has(name));

  return { symbols: [...brought.values()].filter(({ name }) => !conflicting.includes(name)), twice: conflicting };
}

/** The names a file takes from a module by name. */
interface Taken {
  readonly file: string;
  readonly names: ReexportedNames;
  readonly seen: ReadonlySet<string>;
}

/**
 * The names a file exports from another by name. From a file of the project, each is what that
 * file exports under the name, a value, a type or both, with its origin; a name that file is not
 * known to export leaves this one unread. From a package, each is that name of that package. From
 * a module the kit does not find, the name and its kind are known and its origin is this file.
 */
function takenFrom(sources: Sources, { file, names: { source, names }, seen }: Taken): TablesFileExports {
  const resolved = sources.resolve(file, source);

  // A module the kit does not read, a package or a file it does not find: the name and its kind are written here, and
  // nothing else reaches what that module holds through this file. A package is one place for every file that names it.
  if (resolved.kind !== 'file' || seen.has(resolved.path) || seen.size >= DEPTH) {
    return {
      symbols: names.map(({ name, local, isType }) => ({
        name: local,
        kind: isType ? 'type' : 'value',
        origin: resolved.kind === 'package' ? `${resolved.name}#${name}` : `${file}#${local}`,
        declaredHere: false,
      })),
      unread: [],
    };
  }

  const origin = readTablesFile(sources, resolved.path, seen);
  const symbols = names.flatMap(({ name, local, isType }) => asTaken(origin.symbols, { name, local, isType }));
  const unknown = names.filter(({ local }) => !symbols.some((symbol) => symbol.name === local));
  const why = `${file}, which exports ${unknown.map(({ name }) => `\`${name}\``).join(', ')} from '${source}', where the kit does not read what it is`;

  return { symbols, unread: origin.unread.length > 0 ? origin.unread : unknown.length > 0 ? [why] : [] };
}

/** What a name taken from a file is here: its value and its type, or its type alone when taken as a type. */
function asTaken(
  origin: readonly ExportedSymbol[],
  { name, local, isType }: { name: string; local: string; isType: boolean },
): ExportedSymbol[] {
  const held = origin.filter((symbol) => symbol.name === name);
  const asType = held.find(({ kind }) => kind === 'type') ?? held[0];

  if (isType) {
    return asType === undefined ? [] : [{ name: local, kind: 'type', origin: asType.origin, declaredHere: false }];
  }

  return held.map(({ kind, origin: declared }) => ({ name: local, kind, origin: declared, declaredHere: false }));
}

/** A module a file re-exports whole. */
interface Reexport {
  readonly file: string;
  readonly specifier: string;
  readonly seen: ReadonlySet<string>;
}

function reexported(sources: Sources, { file, specifier, seen }: Reexport): TablesFileExports {
  const resolved = sources.resolve(file, specifier);

  if (resolved.kind !== 'file' || seen.size >= DEPTH) {
    return notFollowed(file, specifier);
  }

  // A file already read on the way here adds nothing: a circle of re-exports ends where it started.
  return seen.has(resolved.path) ? { symbols: [], unread: [] } : readTablesFile(sources, resolved.path, seen);
}

function notFollowed(file: string, specifier: string): TablesFileExports {
  return { symbols: [], unread: [`${file}, which re-exports '${specifier}', a module the kit does not follow`] };
}
