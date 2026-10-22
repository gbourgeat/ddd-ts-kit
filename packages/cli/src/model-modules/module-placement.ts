import type { Config } from '../config/index.js';
import { intoModule } from './into-module.js';
import { isContextLevel } from './is-context-level.js';
import { isRoleFolder } from './is-role-folder.js';
import { MODULE_LAYERS } from './module-layers.js';

/** The module of the model a command writes in: `--module <module>` for the context it was given. */
export interface AskedModule {
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

    return inItsModule(sources, role) ?? (writing ? unplaced(sources, role, file) : file);
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

/** The file in the module that holds it, the asked module first; in the asked module when none does. */
function inItsModule(sources: PlacementSources, { context, relative }: RolePath): string | undefined {
  const asked = sources.asked?.context === context ? sources.asked.module : undefined;
  const others = sources.modulesOf(context).filter((module) => module !== asked);

  const inModule = (module: string): string =>
    `${sources.config.contextsDir}/${context}/${intoModule(module, relative)}`;

  const found = [...(asked === undefined ? [] : [asked]), ...others].map(inModule).find(sources.existsAsIs);

  return found ?? (asked === undefined ? undefined : inModule(asked));
}

/** A file written in a context that declares modules, without saying which one: refused, with the way out. */
function unplaced(sources: PlacementSources, { context, relative }: RolePath, file: string): string {
  const declared = (sources.config.contexts[context]?.modules ?? []).length > 0;

  return declared ? sources.unplaced(context, relative) : file;
}
