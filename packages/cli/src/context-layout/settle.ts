import { type ModuleFile, subjectModule } from './subject-module';

/** A file of the context, relative to it, and the module it belongs to once told. */
export interface Placed {
  readonly file: string;
  module: string | undefined;
}

/** What `settle` reads: the module of each file already in one, their production files, and what each open file imports. */
export interface Reading {
  readonly known: ReadonlyMap<string, string | undefined>;
  readonly production: readonly ModuleFile[];
  readonly imports: ReadonlyMap<string, readonly string[]>;
}

/**
 * Tells the module of each open file, until nothing changes: a spec, a builder or a fake named
 * after a file of one module is of it (`subjectModule`); a file that imports files of exactly one module is of it; a file that imports
 * none is of the one module of the open files that import it. A file whose imports name two
 * modules, once every file is told, is of none: it is listed, whatever order the files came in.
 */
export function settle(open: Placed[], reading: Reading): void {
  const named = new Set<Placed>();

  for (const spec of open.filter(({ file }) => file.startsWith('test/'))) {
    spec.module = subjectModule(spec.file, reading.production);

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
