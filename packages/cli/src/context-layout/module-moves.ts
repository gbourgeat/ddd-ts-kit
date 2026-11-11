import { aliasRoots } from '../alias';
import type { Config } from '../config';
import { isDeclarationsFile } from '../declared';
import type { FileMove } from '../file-moves';
import { filesUnder } from '../generate/files-under';
import {
  declaredModules,
  isContextLevel,
  MODULE_LAYERS,
  MODULE_TEST_FOLDERS,
  moduleSplit,
  SHARED_FOLDER,
  SHARED_FOLDERS,
  TEST_FOLDER,
} from '../model-modules';
import type { Workspace } from '../workspace';
import { importsOf } from './imports-of';
import { type Placed, settle } from './settle';

/** The folders of `test/` whose files follow their subject into a module, or go to `shared/` when they have none. */
const PLACED_TEST_FOLDERS: readonly string[] = [...MODULE_TEST_FOLDERS, 'fakes', 'builders'];

/** Where the files of the modules of a context go, and the ones no module could be told for. */
export interface ModuleMoves {
  readonly moves: readonly FileMove[];
  /** Files of a layer left at the level of the context: no module, or more than one, is theirs. */
  readonly unplaced: readonly string[];
  /** Moves not made because a file is at their target already: nothing is overwritten. */
  readonly taken: readonly FileMove[];
}

/** What is read of a context to lay it out: its name, its directory from the project root and the modules of its model. */
interface Laid {
  readonly context: string;
  readonly directory: string;
  readonly modules: readonly string[];
}

/**
 * The moves that give each module of a context its folder, and `shared/` what belongs to none.
 * What a module holds elsewhere goes to its folder: what 0.86 and 0.87 put under `domain/<module>/`
 * and `application/<module>/`, and its specs of `test/unit/<module>/` and `test/integration/<module>/`,
 * which go to `<module>/test/`. A file of a layer, a spec, a fake or a builder left at the level of
 * the context goes to the module of the file it is named after, else of what it imports, or of
 * what imports it when it imports nothing of a module (`settle`). What the context keeps at its
 * own level goes to `shared/`: its schema and tables, its route groups with their guards and shared
 * shapes, its worlds, and the specs, fakes and builders no module could be told for. A file of a
 * layer no module could be told for stays, and is listed. Only a file still at the level of the
 * context moves: run again, nothing does.
 */
export function moduleMoves(ws: Workspace, config: Config, context: string): ModuleMoves {
  const laid = { context, directory: `${config.contextsDir}/${context}`, modules: declaredModules(config, context) };

  if (laid.modules.length === 0) {
    return { moves: [], unplaced: [], taken: [] };
  }

  const files = filesUnder(ws, laid.directory);
  const open: Placed[] = files.filter((file) => isOpen(file, laid)).map((file) => ({ file, module: undefined }));

  settle(open, reading(ws, config, { files, open, laid }));

  const placed = open.flatMap(({ file, module }) => placedMove(file, module));
  const at = (file: string): string => `${laid.directory}/${file}`;

  const all = [...files.flatMap((file) => heldMove(file, laid)), ...placed].map(({ from, to }) => ({
    from: at(from),
    to: at(to),
  }));

  return {
    moves: all.filter((move) => !ws.exists(move.to)),
    unplaced: open.filter(({ file, module }) => module === undefined && !isTest(file)).map(({ file }) => at(file)),
    taken: all.filter((move) => ws.exists(move.to)),
  };
}

/** What `reading` is given: the files of the context, the open ones among them, and the context. */
interface Read {
  readonly files: readonly string[];
  readonly open: readonly Placed[];
  readonly laid: Laid;
}

/** What `settle` reads of the context: the module of each of its files, the production files of its modules, the imports of the open files. */
function reading(ws: Workspace, config: Config, { files, open, laid }: Read): Parameters<typeof settle>[1] {
  const { directory, modules } = laid;
  const split = files.map((file) => ({ file, ...moduleSplit(file, modules) }));

  return {
    known: new Map(split.map(({ file, module }) => [file, module])),
    production: split.flatMap(({ module, path }) => (module === undefined || isTest(path) ? [] : [{ path, module }])),
    imports: new Map(open.map(({ file }) => [file, importsOf(ws, { directory, file, roots: aliasRoots(config) })])),
  };
}

/**
 * The move of a file that needs no telling. A file of a module that sits outside its folder goes
 * into it (`domain/<module>/...` as 0.86 and 0.87 laid it out, `test/unit/<module>/...`); what the
 * context keeps at its own level, and its worlds, go to `shared/`.
 */
function heldMove(file: string, { context, modules }: Laid): { from: string; to: string }[] {
  const { module, path, shared } = moduleSplit(file, modules);
  const [top = '', folder] = file.split('/');

  if (module !== undefined) {
    return file === `${module}/${path}` || path === '' ? [] : [{ from: file, to: `${module}/${path}` }];
  }

  const ofTheContext = top === TEST_FOLDER ? folder === 'worlds' : isContextLevel(context, file);

  return shared !== true && SHARED_FOLDERS.includes(top) && ofTheContext
    ? [{ from: file, to: `${SHARED_FOLDER}/${file}` }]
    : [];
}

/** The move of a file once told: into its module, or into `shared/` for a file of the tests no module is told for. */
function placedMove(file: string, module: string | undefined): { from: string; to: string }[] {
  if (module !== undefined) {
    return [{ from: file, to: `${module}/${file}` }];
  }

  return isTest(file) ? [{ from: file, to: `${SHARED_FOLDER}/${file}` }] : [];
}

/**
 * A file left at the level of the context that a module may own: a file of a role folder of a
 * layer, a spec of `test/unit/` or `test/integration/`, a fake or a builder, in no module yet.
 */
function isOpen(file: string, { context, modules }: Laid): boolean {
  const [top = '', folder = '', ...rest] = file.split('/');

  if (rest.length === 0 || moduleSplit(file, modules).module !== undefined) {
    return false;
  }

  if (top === TEST_FOLDER) {
    return PLACED_TEST_FOLDERS.includes(folder) && (!MODULE_TEST_FOLDERS.includes(folder) || file.endsWith('.spec.ts'));
  }

  return MODULE_LAYERS.includes(top) && !isContextLevel(context, file) && !isDeclarationsFile(context, file, modules);
}

function isTest(file: string): boolean {
  return file.startsWith(`${TEST_FOLDER}/`);
}
