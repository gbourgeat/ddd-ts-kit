import path from 'node:path';
import type { Config } from '../config';
import { intoModule } from './into-module';
import { isContextLevel } from './is-context-level';
import { isHeldByShared } from './is-held-by-shared';
import { MODULE_LAYERS, SHARED_FOLDER, TEST_FOLDER } from './module-layers';

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
  /** The module whose production file a spec, a fake or a builder of a context is named after, if one is. */
  readonly subjectModule: (context: string, spec: string) => string | undefined;
}

/** A path of a role folder of a context, split into the context and the path relative to it. */
interface RolePath {
  readonly context: string;
  readonly relative: string;
}

/**
 * Where a path of a context divided into modules, written as it would be without them, is. What
 * belongs to no module is in `shared/` (`isHeldByShared`); the code list and the permission set
 * stay as written, at the root. A file of a layer is in the module that holds it, the asked one
 * first, or, for a file being written, in the asked module; one still at the level of the
 * context, which `move-to-module` has not moved yet, is read there. A spec, a fake or a builder
 * goes with its subject, in the test folder of the module that holds the file it is named after,
 * and in `shared/test/` when no module does. A path of a context without modules is as written.
 */
export function modulePlacement(sources: PlacementSources): (file: string, writing: boolean) => string {
  return (file, writing) => {
    const role = rolePathOf(sources, file);

    if (role === undefined) {
      return file;
    }

    const inShared = `${sources.config.contextsDir}/${role.context}/${SHARED_FOLDER}/${role.relative}`;

    if (isHeldByShared(role.relative)) {
      return readWhereItIs(sources, file, inShared);
    }

    if (role.relative.startsWith(`${TEST_FOLDER}/`)) {
      return testInItsModule(sources, role) ?? inShared;
    }

    if (isContextLevel(role.context, role.relative) || sources.existsAsIs(file)) {
      return file;
    }

    return inItsModule(sources, role, writing) ?? (writing ? sources.unplaced(role.context, role.relative) : file);
  };
}

/** What belongs to no module is in `shared/`; what a context in the middle of its move still holds at its own level is read there. */
function readWhereItIs({ existsAsIs }: PlacementSources, file: string, inShared: string): string {
  return !existsAsIs(inShared) && existsAsIs(file) ? file : inShared;
}

/** The path a file has in a context divided into modules, when it is written in a layer or in the test folder. */
function rolePathOf({ config, modulesOf }: PlacementSources, file: string): RolePath | undefined {
  const prefix = `${config.contextsDir}/`;
  const [context = '', ...parts] = file.startsWith(prefix) ? file.slice(prefix.length).split('/') : [];
  const [top = ''] = parts;
  const held = parts.length > 1 && (MODULE_LAYERS.includes(top) || top === TEST_FOLDER);

  return held && modulesOf(context).length > 0 ? { context, relative: parts.join('/') } : undefined;
}

/** A spec, a fake or a builder in its module: the one that holds it, the asked one, or the one that holds its subject. */
function testInItsModule(sources: PlacementSources, role: RolePath): string | undefined {
  const { context, relative } = role;
  const asked = sources.asked?.context === context ? sources.asked.module : undefined;
  const candidates = candidatesOf(sources, role, asked);
  const holding = candidates.ordered.find((module) => sources.existsAsIs(candidates.inModule(module)));
  const chosen = holding ?? asked ?? sources.subjectModule(context, path.posix.basename(relative));

  return chosen === undefined ? undefined : candidates.inModule(chosen);
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
  /** Any path of the context, written without modules, in a module: what holds the use case of the file. */
  readonly placedIn: (module: string, relative: string) => string;
}

function candidatesOf(
  sources: PlacementSources,
  { context, relative }: RolePath,
  asked: string | undefined,
): Candidates {
  const others = sources.modulesOf(context).filter((module) => module !== asked);

  const placedIn = (module: string, file: string): string =>
    `${sources.config.contextsDir}/${context}/${intoModule(module, file)}`;

  return {
    ordered: [...(asked === undefined ? [] : [asked]), ...others],
    inModule: (module) => placedIn(module, relative),
    placedIn,
  };
}

/**
 * The module that holds the file, or, for a file of a use case, the one that holds a folder of
 * that use case: its folder of `application/commands/` or `application/queries/`, or, for a file
 * of its route, the folder of the route and the folder of the use case it sends.
 */
function holderOf(
  sources: PlacementSources,
  { ordered, inModule, placedIn }: Candidates,
  relative: string,
): string | undefined {
  const holding = ordered.find((module) => sources.existsAsIs(inModule(module)));
  const folders = useCaseFoldersOf(relative);

  return holding ?? ordered.find((module) => folders.some((folder) => sources.existsAsIs(placedIn(module, folder))));
}

/** The folders, written without modules, that name the use case a file belongs to; none for a file of no use case. */
function useCaseFoldersOf(relative: string): string[] {
  const parts = relative.split('/');
  const [layer, role = '', first = '', second = ''] = parts;
  const inUseCase = parts.length > 4;

  if (layer === 'application' && ['commands', 'queries'].includes(role) && parts.length > 3) {
    return [`application/${role}/${first}`];
  }

  return layer === 'presentation' && role === 'http' && inUseCase
    ? [`presentation/http/${first}/${second}`, `application/commands/${second}`, `application/queries/${second}`]
    : [];
}
