import { posix } from 'node:path';
import { fileSeverity } from '../check/project/file-severity';
import { type Config, projectSeverity } from '../config';
import type { FileMove } from '../file-moves';
import { declaredModules, moduleSplit } from '../model-modules';
import type { Workspace } from '../workspace';
import { type ClosedCycle, closedCycles } from './closed-cycles';
import { moduleImportsIn } from './module-imports-in';
import { placeInModule } from './place-in-module';

const RULE = 'module/no-cycle';

/** The cycles between modules a move closes, and what moved with it would avoid them. */
export interface MoveCycles {
  /** Each cycle with its files named where the move puts them. */
  readonly cycles: readonly ClosedCycle[];
  /** The files at the other end of the imports the move adds, that the command can move too: relative to the context. */
  readonly along: readonly string[];
}

/**
 * Reads the imports between the modules of a context before a move, and answers what tells, once
 * the move is planned in the workspace, the cycles it closes. The command judges what the rule
 * judges: a project that turns `module/no-cycle` off is told of none, nor of a cycle whose every
 * import is in a file the config turns the rule off for.
 */
export function watchCycles(
  ws: Workspace,
  config: Config,
  context: string,
): (moved: readonly FileMove[]) => MoveCycles {
  if (projectSeverity(config.rules[RULE]) === 'off') {
    return () => ({ cycles: [], along: [] });
  }

  const before = moduleImportsIn(ws, config, context);

  return (moved) => {
    const cycles = closedCycles(before, moduleImportsIn(ws, config, context)).filter((cycle) =>
      cycle.steps.some(({ imports }) => imports.some(({ file }) => fileSeverity(config, RULE, file) !== 'off')),
    );

    return { cycles, along: alongOf(ws, config, { context, cycles, moved }) };
  };
}

/** What `alongOf` reads: the context, the cycles the move closes and the files it moves. */
interface Closed {
  readonly context: string;
  readonly cycles: readonly ClosedCycle[];
  readonly moved: readonly FileMove[];
}

/**
 * An import the move adds joins a file it moves and one it leaves: moved too, the second one is in
 * the module of the first, and the import no longer goes from a module to another. A file of a
 * folder below its role folder (a use case, a route) is named by that folder, which moves whole,
 * and so is the `index.ts` an import of a folder reaches.
 */
function alongOf(ws: Workspace, config: Config, { context, cycles, moved }: Closed): string[] {
  const directory = `${config.contextsDir}/${context}`;
  const held = { context, modules: declaredModules(config, context) };
  const arrived = new Set(moved.map(({ to }) => to));

  const others = cycles
    .flatMap(({ steps }) => steps.filter(({ added }) => added).flatMap(({ imports }) => imports))
    .map(({ file, imported }) => (arrived.has(file) ? imported : file))
    .filter((file) => ws.exists(file))
    .map((file) => file.slice(directory.length + 1))
    .filter((file) => placeInModule(file, held) === 'moves')
    .map((file) => whatMovesWith(file, held.modules));

  return [...new Set(others)].sort();
}

/** The number of folders that lead to a file directly in its role folder: its layer and that folder. */
const TO_THE_ROLE_FOLDER = 2;

/** The file itself, or the folder it moves with: the one below its role folder, or the one its `index.ts` stands for. */
function whatMovesWith(file: string, modules: readonly string[]): string {
  const folders = moduleSplit(file, modules).path.split('/').length - 1;

  return folders > TO_THE_ROLE_FOLDER || posix.basename(file) === 'index.ts' ? posix.dirname(file) : file;
}
