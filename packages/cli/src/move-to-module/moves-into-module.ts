import { CliError } from '../cli-error.js';
import type { Config } from '../config/index.js';
import { isDeclarationsFile } from '../declared/index.js';
import { filesUnder } from '../generate/files-under.js';
import { intoModule, isContextLevel, isRoleFolder, moduleSplit } from '../model-modules/index.js';
import type { Workspace } from '../workspace/index.js';
import type { ModuleMove } from './module-move.js';

/** What to move: a context, the module it goes into, and paths relative to the context. */
export interface MoveRequest {
  readonly context: string;
  readonly module: string;
  readonly paths: readonly string[];
}

/**
 * The files the paths name, a file or a folder of a role of domain/ or application/, each with
 * where it goes in the module: the files that stay one per context and the generated
 * declarations stay where they are.
 */
export function movesIntoModule(ws: Workspace, config: Config, request: MoveRequest): ModuleMove[] {
  const directory = `${config.contextsDir}/${request.context}`;

  const moves = request.paths.flatMap((asked) => {
    const relative = asked.replace(/^\.\//, '').replace(/\/+$/, '');

    const files =
      ws.exists(`${directory}/${relative}`) && ws.read(`${directory}/${relative}`) !== undefined
        ? [relative]
        : filesUnder(ws, `${directory}/${relative}`).map((file) => `${relative}/${file}`);

    if (files.length === 0) {
      throw new CliError(
        `${directory}/${relative} does not exist.`,
        'Name a file or a folder of a role of domain/ or application/, relative to the context: domain/aggregates/waitlist.aggregate.ts, application/commands/join-waitlist.',
      );
    }

    return files.flatMap((file) => moveOf(directory, request, file));
  });

  return [...new Map(moves.map((move) => [move.from, move])).values()];
}

function moveOf(directory: string, { context, module }: MoveRequest, file: string): ModuleMove[] {
  const { path } = moduleSplit(file);
  const [layer = '', folder = ''] = path.split('/');

  if (!isRoleFolder(layer, folder)) {
    throw new CliError(
      `${file} is not in a role folder of domain/ or application/ of "${context}".`,
      'Only the model and its use cases are divided into modules: infrastructure/, presentation/, test/ and published-language/ keep their layout.',
    );
  }

  if (isContextLevel(context, path) || isDeclarationsFile(context, file)) {
    return [];
  }

  const to = intoModule(module, path);

  return to === file ? [] : [{ from: `${directory}/${file}`, to: `${directory}/${to}` }];
}
