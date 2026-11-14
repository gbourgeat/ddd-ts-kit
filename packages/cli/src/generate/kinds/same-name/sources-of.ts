import { posix } from 'node:path';
import { resolveImport } from '../../../check/project/resolve-import';
import type { Config } from '../../../config';

/** Reads a file of the project; undefined when it holds none. */
export type FileReader = (file: string) => string | undefined;

/**
 * What a module specifier names: a file of the project that exists, by its path from the project
 * root; a package; or nothing the kit resolves, a relative or alias specifier whose file it does
 * not find, one the compiler may still resolve (`.mts`, `.cts`, `.tsx`, `.d.ts`).
 */
type Resolved =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'unresolved' };

/** The files of a project and the one way a specifier written in one of them is resolved. */
export interface Sources {
  readonly read: FileReader;
  readonly resolve: (from: string, specifier: string) => Resolved;
}

/** What the compiler may read for a module written without its ending, beside the `.ts` file the kit reads. */
const ENDINGS = ['.ts', '.tsx', '.d.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'];

/**
 * The one resolver of what the schema index and the tables files name: relative specifiers and the
 * aliases of the project are resolved as the checker resolves them, to a `.ts` file or to the
 * `index.ts` of a folder, which has to exist; a bare specifier that is no alias is a package. Two
 * specifiers that name one file, an alias and a relative path, resolve to the same path. Where the
 * compiler could read something else than the kit, nothing is resolved: a file and a folder of one
 * name, a `.tsx`, a `.d.ts` or a `.js` beside the `.ts`, a folder that holds a `package.json`, an
 * ending the kit does not read. `.`, `..` and a specifier that ends with a slash name a folder,
 * never the file of its name beside it. `place` gives a file the path a command reads it at.
 */
export function sourcesOf(
  config: Config,
  readFile: FileReader,
  place: (file: string) => string = (file) => file,
): Sources {
  // One reading asks for the same file many times, and each may cost a process.
  const held = new Map<string, string | undefined>();

  const read: FileReader = (file) => {
    if (!held.has(file)) {
      held.set(file, readFile(file));
    }

    return held.get(file);
  };

  return {
    read,
    resolve: (from, specifier) => placedIn(resolved(config, read, { from, specifier }), place),
  };
}

/**
 * A file a command places in a module of the model (`shared/` of a context laid out in modules)
 * is that file, whatever path names it: one identity for one file.
 */
function placedIn(target: Resolved, place: (file: string) => string): Resolved {
  return target.kind === 'file' ? { kind: 'file', path: place(target.path) } : target;
}

function resolved(
  config: Config,
  read: FileReader,
  { from, specifier }: { from: string; specifier: string },
): Resolved {
  const target = resolveImport(config, from, specifier);

  if (target.kind !== 'file') {
    return { kind: 'package', name: specifier };
  }

  // `./tables.mjs` is `tables.mts` to the compiler, which the kit does not read: never the `tables.ts` beside it.
  if (/\.[mc][jt]s$|\.tsx$|\.d\.ts$/.test(specifier) || !target.path.endsWith('.ts')) {
    return { kind: 'unresolved' };
  }

  const base = posix.normalize(target.path.replace(/\.ts$/, '')).replace(/\/$/, '');
  const isFolder = /(?:^|\/)\.{1,2}$|\/$/.test(specifier);

  const found = [
    ...(isFolder ? [] : ENDINGS.map((ending) => `${base}${ending}`)),
    ...ENDINGS.map((ending) => `${base}/index${ending}`),
    `${base}/package.json`,
  ].filter((file) => read(file) !== undefined);

  const [path = ''] = found;

  return found.length === 1 && path.endsWith('.ts') && !path.endsWith('.d.ts')
    ? { kind: 'file', path }
    : { kind: 'unresolved' };
}
