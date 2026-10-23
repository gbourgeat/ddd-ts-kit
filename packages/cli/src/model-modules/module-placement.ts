import path from 'node:path';
import type { Config } from '../config/index.js';
import { intoModule } from './into-module.js';
import { isContextLevel } from './is-context-level.js';
import { isRoleFolder } from './is-role-folder.js';
import { MODULE_LAYERS } from './module-layers.js';

/** The module of the model a command writes in: `--module <module>` for the context it was given. */
interface AskedModule {
  readonly context: string;
  readonly module: string;
}

export interface PlacementSources {
  readonly config: Config;
  readonly asked: AskedModule | undefined;
  /** True when a file or a directory is at this very path, on disk or planned. */
  readonly existsAsIs: (file: string) => boolean;
  /** The modules a context holds, declared or found on disk. */
  readonly modulesOf: (context: string) => readonly string[];
  /** Called when a file would be written outside every module of a context that declares modules: it throws. */
  readonly unplaced: (context: string, relative: string) => never;
  /** Called when `--module` names another module than the one that holds the use case of the file: it throws. */
  readonly split: (context: string, relative: string, holder: string) => never;
}

/** A path of a role folder of a context, split into the context and the path relative to it. */
interface RolePath {
  readonly context: string;
  readonly relative: string;
}

/**
 * Where a path of a context, written as it would be without modules of its model, is: as written
 * when the file is there or stays one per context; else in the module that holds it, the asked
 * one first; else, for a file being written, in the asked module.
 */
export function modulePlacement(sources: PlacementSources): (file: string, writing: boolean) => string {
  return (file, writing) => {
    const role = rolePathOf(sources.config, file);

    if (role === undefined || isContextLevel(role.context, role.relative) || sources.existsAsIs(file)) {
      return file;
    }

    return inItsModule(sources, role, writing) ?? (writing ? unplaced(sources, role, file) : file);
  };
}

/** The path a role file has in a context, when it is written in a role folder of domain/ or application/. */
function rolePathOf(config: Config, file: string): RolePath | undefined {
  const prefix = `${config.contextsDir}/`;

  const [context = '', layer = '', folder = '', ...rest] = file.startsWith(prefix)
    ? file.slice(prefix.length).split('/')
    : [];

  if (rest.length === 0 || !MODULE_LAYERS.includes(layer) || !isRoleFolder(layer, folder)) {
    return undefined;
  }

  return { context, relative: [layer, folder, ...rest].join('/') };
}

/**
 * The file in the module that holds it, the asked module first; else in the module that holds
 * its use case (`application/commands/<use-case>/`); else in the asked module. A write that
 * `--module` sends to another module than the one holding the file or its use case is refused:
 * it would split the use case.
 */
function inItsModule(sources: PlacementSources, role: RolePath, writing: boolean): string | undefined {
  const { context, relative } = role;
  const asked = sources.asked?.context === context ? sources.asked.module : undefined;
  const candidates = candidatesOf(sources, role, asked);
  const holder = holderOf(sources, candidates, relative);

  if (writing && holder !== undefined && asked !== undefined && holder !== asked) {
    return sources.split(context, relative, holder);
  }

  const chosen = holder ?? asked;

  return chosen === undefined ? undefined : candidates.inModule(chosen);
}

/** The modules a file may sit in, the asked one first, and the path it has in each. */
interface Candidates {
  readonly ordered: readonly string[];
  readonly inModule: (module: string) => string;
}

function candidatesOf(
  sources: PlacementSources,
  { context, relative }: RolePath,
  asked: string | undefined,
): Candidates {
  const others = sources.modulesOf(context).filter((module) => module !== asked);

  return {
    ordered: [...(asked === undefined ? [] : [asked]), ...others],
    inModule: (module) => `${sources.config.contextsDir}/${context}/${intoModule(module, relative)}`,
  };
}

/**
 * The module that holds the file, or, for a file of a use case (`application/commands/<use-case>/<file>`),
 * the one that holds the folder of the use case: the folder names what the file belongs to.
 */
function holderOf(sources: PlacementSources, { ordered, inModule }: Candidates, relative: string): string | undefined {
  const holding = ordered.find((module) => sources.existsAsIs(inModule(module)));

  if (holding !== undefined || relative.split('/').length <= 3) {
    return holding;
  }

  return ordered.find((module) => sources.existsAsIs(path.posix.dirname(inModule(module))));
}

/** A file written in a context that declares modules, without saying which one: refused, with the way out. */
function unplaced(sources: PlacementSources, { context, relative }: RolePath, file: string): string {
  const declared = (sources.config.contexts[context]?.modules ?? []).length > 0;

  return declared ? sources.unplaced(context, relative) : file;
}
