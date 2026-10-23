import { posix } from 'node:path';
import { CliError } from '../cli-error';
import type { Config } from '../config';
import { isDeclarationsFile } from '../declared';
import { filesUnder } from '../generate/files-under';
import {
  declaredModules,
  intoModule,
  isContextLevel,
  isRoleFolder,
  MODULE_LAYERS,
  MODULE_TEST_FOLDERS,
  moduleSplit,
} from '../model-modules';
import type { Workspace } from '../workspace';
import type { ModuleMove } from './module-move';

/** What to move: a context, the module it goes into, and paths relative to the context. */
export interface MoveRequest {
  readonly context: string;
  readonly module: string;
  readonly paths: readonly string[];
}

/**
 * The files the paths name, a file or a folder of a role of a layer or a spec, each with
 * where it goes in the module: the files that stay one per context and the generated
 * declarations stay where they are.
 */
export function movesIntoModule(ws: Workspace, config: Config, request: MoveRequest): ModuleMove[] {
  const directory = `${config.contextsDir}/${request.context}`;
  const placement = { ...request, directory, modules: declaredModules(config, request.context) };

  const moves = request.paths.flatMap((asked) => {
    const relative = asked.replace(/^\.\//, '').replace(/\/+$/, '');

    const files =
      ws.exists(`${directory}/${relative}`) && ws.read(`${directory}/${relative}`) !== undefined
        ? [relative]
        : filesUnder(ws, `${directory}/${relative}`).map((file) => `${relative}/${file}`);

    if (files.length === 0) {
      throw new CliError(
        `${directory}/${relative} does not exist.`,
        'Name a file or a folder of a role of a layer, or a spec, relative to the context: domain/aggregates/waitlist.aggregate.ts, application/commands/join-waitlist.',
      );
    }

    return files.flatMap((file) => moveOf(file, placement));
  });

  // The specs of a moved file go with it, into the module folder of their test folder.
  const specs = specsOf(ws, moves, placement).flatMap((file) => moveOf(file, placement));
  const unique = [...new Map([...moves, ...specs].map((move) => [move.from, move])).values()];

  refuseLosses(ws, unique, placement);

  return unique;
}

/** Where the files go: the context, its directory, the modules of its model and the one the files go into. */
interface Placement {
  readonly context: string;
  readonly directory: string;
  readonly modules: readonly string[];
  readonly module: string;
}

/**
 * Nothing is written when a move would lose a file: a target that exists already (two files of
 * one name in two modules), or a file the workspace cannot carry as text.
 */
function refuseLosses(ws: Workspace, moves: readonly ModuleMove[], placement: Placement): void {
  const landing = new Map<string, number>();

  for (const move of moves) {
    landing.set(move.to, (landing.get(move.to) ?? 0) + 1);
  }

  const colliding = moves.filter((move) => (landing.get(move.to) ?? 0) > 1).map((move) => move.to);
  const taken = moves.filter((move) => ws.exists(move.to)).map((move) => move.to);

  if (colliding.length > 0 || taken.length > 0) {
    throw new CliError(
      `Nothing was moved: ${[...new Set([...colliding, ...taken])].join(', ')} would be written twice, or exist(s) already.`,
      'Two files of one name cannot share a module: rename one after the concept it holds, or merge them by hand, then run the command again.',
    );
  }

  const twins = moves.flatMap((move) => twinsOf(ws, move, placement));

  if (twins.length > 0) {
    throw new CliError(
      `Nothing was moved: ${twins.join(', ')} hold(s) a file of the same role and name.`,
      'One name is one concept in a context, and the declarations of the context would export it twice: rename one after the concept it holds, or move the two into the module that owns the concept.',
    );
  }

  const binary = moves.filter((move) => (ws.read(move.from) ?? '').includes('\u0000')).map((move) => move.from);

  if (binary.length > 0) {
    throw new CliError(
      `Nothing was moved: ${binary.join(', ')} is not a text file.`,
      'Move it by hand with git mv, then run the command again without it.',
    );
  }
}

/**
 * The specs of the context named after a moved production file (`appointment.repository.contract.spec.ts`
 * is of `appointment.repository.ts`), wherever they sit in `test/unit/` and `test/integration/`,
 * relative to the context.
 */
function specsOf(ws: Workspace, moves: readonly ModuleMove[], { directory, modules }: Placement): string[] {
  const names = moves
    .filter((move) => !move.from.slice(directory.length + 1).startsWith('test/'))
    .map((move) => posix.basename(move.from).replace(/\.ts$/, ''));

  return MODULE_TEST_FOLDERS.flatMap((folder) =>
    filesUnder(ws, `${directory}/test/${folder}`).map((file) => `test/${folder}/${file}`),
  ).filter((file) => {
    const stem = posix.basename(file).replace(/\.spec\.ts$/, '');
    const inPlace = moduleSplit(file, modules).module === undefined;

    return inPlace && file.endsWith('.spec.ts') && names.some((name) => stem === name || stem.startsWith(`${name}.`));
  });
}

/** The same file of the role in another module, or at the level of the context, a move would make a twin of. */
function twinsOf(ws: Workspace, move: ModuleMove, { directory, modules, module }: Placement): string[] {
  const inContext = move.to.slice(directory.length + 1);
  const { path } = moduleSplit(inContext, modules);
  const elsewhere = [path, ...modules.filter((other) => other !== module).map((other) => intoModule(other, path))];

  return elsewhere
    .map((candidate) => `${directory}/${candidate}`)
    .filter((file) => file !== move.from && ws.exists(file));
}

function moveOf(file: string, { context, directory, modules, module }: Placement): ModuleMove[] {
  const { path } = moduleSplit(file, modules);
  const [layer = '', folder = ''] = path.split('/');
  const inLayer = MODULE_LAYERS.includes(layer) && isRoleFolder(layer, folder);

  if (!inLayer && !(layer === 'test' && MODULE_TEST_FOLDERS.includes(folder))) {
    throw new CliError(
      `${file} is in no role folder of a layer of "${context}", and in no test/unit/ nor test/integration/.`,
      'A module holds the files of the layers of its concepts and their specs: published-language/, the fakes, the builders and the worlds stay at the level of the context.',
    );
  }

  if (isContextLevel(context, path) || isDeclarationsFile(context, file, modules)) {
    return [];
  }

  const to = intoModule(module, path);

  return to === file ? [] : [{ from: `${directory}/${file}`, to: `${directory}/${to}` }];
}
