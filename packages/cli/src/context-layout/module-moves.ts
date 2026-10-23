import { posix } from 'node:path';
import { aliasRoots, type AliasRoot } from '../alias';
import type { Config } from '../config';
import { isDeclarationsFile } from '../declared';
import type { FileMove } from '../file-moves';
import { filesUnder } from '../generate/files-under';
import {
  declaredModules,
  intoModule,
  isContextLevel,
  MODULE_LAYERS,
  MODULE_TEST_FOLDERS,
  moduleSplit,
} from '../model-modules';
import type { Workspace } from '../workspace';

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
const EXTENSION = /\.(?:ts|js)$/;

/** Where the files of the modules of a context go, and the ones no module could be told for. */
export interface ModuleMoves {
  readonly moves: readonly FileMove[];
  /** Files of a layer or specs left at the level of the context: no module, or more than one, is theirs. */
  readonly unplaced: readonly string[];
  /** Moves not made because a file is at their target already: nothing is overwritten. */
  readonly taken: readonly FileMove[];
}

/** A file of the context, relative to it, and the module it belongs to once told. */
interface Placed {
  readonly file: string;
  module: string | undefined;
}

/**
 * The moves that give each module of a context its folder: what 0.86 and 0.87 put under `domain/<module>/`
 * and `application/<module>/` goes to `<module>/domain/` and `<module>/application/`; an adapter,
 * a route or a spec left at the level of the context goes to the module of what it imports (or,
 * for a spec, of the file it is named after), or of what imports it when it imports nothing of a
 * module. The files the context keeps at its own level stay, and so does a file whose imports
 * name two modules, or none: it is listed.
 */
export function moduleMoves(ws: Workspace, config: Config, context: string): ModuleMoves {
  const directory = `${config.contextsDir}/${context}`;
  const modules = declaredModules(config, context);

  if (modules.length === 0) {
    return { moves: [], unplaced: [], taken: [] };
  }

  const files = filesUnder(ws, directory);
  const earlier = files.flatMap((file) => earlierMove(file, modules));
  const known = new Map(files.map((file) => [file, moduleSplit(file, modules).module]));

  const open: Placed[] = files
    .filter((file) => isOpen(context, file, modules))
    .map((file) => ({ file, module: undefined }));

  const imports = new Map(
    open.map(({ file }) => [file, importsOf(ws, { directory, file, roots: aliasRoots(config) })]),
  );

  settle(open, { known, imports, modules });

  const placed = open.flatMap(({ file, module }) =>
    module === undefined ? [] : [{ from: file, to: intoModule(module, file) }],
  );

  const at = (file: string): string => `${directory}/${file}`;

  const all = [...earlier, ...placed].map(({ from, to }) => ({ from: at(from), to: at(to) }));

  return {
    moves: all.filter((move) => !ws.exists(move.to)),
    unplaced: open.filter(({ module }) => module === undefined).map(({ file }) => at(file)),
    taken: all.filter((move) => ws.exists(move.to)),
  };
}

/** A file of a module where 0.86 and 0.87 put it, with its place of today. */
function earlierMove(file: string, modules: readonly string[]): { from: string; to: string }[] {
  const { module, path, earlier } = moduleSplit(file, modules);

  return earlier === true ? [{ from: file, to: intoModule(module, path) }] : [];
}

/** A file of a layer, or a spec directly in a test folder, left at the level of the context, that a module may own. */
function isOpen(context: string, file: string, modules: readonly string[]): boolean {
  return (
    (isLayerFile(file, modules) || isSpecInPlace(file, modules)) &&
    !isContextLevel(context, file) &&
    !isDeclarationsFile(context, file, modules)
  );
}

function isLayerFile(file: string, modules: readonly string[]): boolean {
  const [layer = '', , ...rest] = file.split('/');

  return MODULE_LAYERS.includes(layer) && rest.length > 0 && moduleSplit(file, modules).module === undefined;
}

/** A spec of `test/unit/` or `test/integration/`, at any depth, in no module yet. */
function isSpecInPlace(file: string, modules: readonly string[]): boolean {
  const [top, folder = '', ...rest] = file.split('/');

  return (
    top === 'test' &&
    MODULE_TEST_FOLDERS.includes(folder) &&
    rest.length > 0 &&
    file.endsWith('.spec.ts') &&
    moduleSplit(file, modules).module === undefined
  );
}

/** What `settle` reads: the module of each file already in one, what each open file imports, the modules. */
interface Reading {
  readonly known: ReadonlyMap<string, string | undefined>;
  readonly imports: ReadonlyMap<string, readonly string[]>;
  readonly modules: readonly string[];
}

/**
 * Tells the module of each open file, until nothing changes: a spec named after a file of one
 * module is of it; a file that imports files of exactly one module is of it; a file that imports
 * none is of the one module of the open files that import it. A file whose imports name two
 * modules, once every file is told, is of none: it is listed, whatever order the files came in.
 */
function settle(open: Placed[], reading: Reading): void {
  const { known, modules } = reading;
  const named = new Set<Placed>();

  for (const spec of open.filter(({ file }) => file.startsWith('test/'))) {
    spec.module = namedAfter(spec.file, known, modules);

    if (spec.module !== undefined) {
      named.add(spec);
    }
  }

  const conflicting = new Set<Placed>();

  do {
    tellByImports(open, reading, conflicting);
  } while (withdrawTwoModules(open, reading, { named, conflicting }));
}

/** Gives each open file the module its imports, or else its importers, name, until nothing changes. */
function tellByImports(open: Placed[], reading: Reading, conflicting: ReadonlySet<Placed>): void {
  let changed = true;

  while (changed) {
    changed = false;

    for (const placed of open.filter((candidate) => candidate.module === undefined && !conflicting.has(candidate))) {
      const reached = modulesReached(placed, open, reading);
      const importers = open.filter(({ file }) => (reading.imports.get(file) ?? []).includes(placed.file));
      const told = reached.length > 0 ? only(reached) : only(importers.map(({ module }) => module));

      if (told !== undefined) {
        placed.module = told;
        changed = true;
      }
    }
  }
}

/** What was told by name, and what was found to name two modules. */
interface Settling {
  readonly named: ReadonlySet<Placed>;
  readonly conflicting: Set<Placed>;
}

/** Takes its module back from every file whose imports name two modules; answers whether one was. */
function withdrawTwoModules(open: Placed[], reading: Reading, { named, conflicting }: Settling): boolean {
  const twice = open.filter(
    (placed) =>
      placed.module !== undefined && !named.has(placed) && new Set(modulesReached(placed, open, reading)).size > 1,
  );

  for (const placed of twice) {
    placed.module = undefined;
    conflicting.add(placed);
  }

  return twice.length > 0;
}

/** The modules of the files a file imports, those of the open files told so far included. */
function modulesReached(placed: Placed, open: readonly Placed[], { known, imports }: Reading): string[] {
  return (imports.get(placed.file) ?? []).flatMap((file) => {
    const module = known.get(file) ?? open.find((candidate) => candidate.file === file)?.module;

    return module === undefined ? [] : [module];
  });
}

/** The one module of a list, undefined when it names none or two. */
function only(modules: readonly (string | undefined)[]): string | undefined {
  const named = [...new Set(modules.filter((module): module is string => module !== undefined))];

  return named.length === 1 ? named[0] : undefined;
}

/** The module of the production file a spec is named after, the longest name winning. */
function namedAfter(
  spec: string,
  known: ReadonlyMap<string, string | undefined>,
  modules: readonly string[],
): string | undefined {
  const stem = posix.basename(spec).replace(/\.spec\.ts$/, '');

  const matches = [...known].flatMap(([file, module]) => {
    const name = posix.basename(file).replace(EXTENSION, '');
    const own = module !== undefined && modules.includes(module) && !file.startsWith('test/');

    return own && (stem === name || stem.startsWith(`${name}.`)) ? [{ module, length: name.length }] : [];
  });

  return matches.sort((left, right) => right.length - left.length)[0]?.module;
}

/** Where a file of the context sits and how its imports are read. */
interface Importing {
  readonly directory: string;
  readonly file: string;
  readonly roots: readonly AliasRoot[];
}

/** The files of the context a file imports, relative to the context and with their extension, by alias or relative path. */
function importsOf(ws: Workspace, { directory, file, roots }: Importing): string[] {
  const text = ws.read(`${directory}/${file}`) ?? '';

  return [...text.matchAll(SPECIFIER)].flatMap(([, , specifier = '']) => {
    const bare = specifier.replace(EXTENSION, '');
    const root = roots.find(({ prefix }) => bare.startsWith(prefix));

    const target = bare.startsWith('.')
      ? posix.join(posix.dirname(`${directory}/${file}`), bare)
      : root === undefined
        ? undefined
        : `${root.directory}/${bare.slice(root.prefix.length)}`;

    return target !== undefined && target.startsWith(`${directory}/`)
      ? [`${target.slice(directory.length + 1)}.ts`]
      : [];
  });
}
