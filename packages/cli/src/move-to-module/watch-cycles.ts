import type { ModuleImport } from '../check/modules/module-imports';
import { type Config, projectSeverity } from '../config';
import type { FileMove } from '../file-moves';
import { declaredModules } from '../model-modules';
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
 * the move is planned in the workspace, the cycles it closes. A project that turns `module/no-cycle`
 * off is told of none: the command judges what the rule judges.
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
    const cycles = closedCycles(before, moduleImportsIn(ws, config, context));

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
 * the module of the first, and the import no longer goes from a module to another.
 */
function alongOf(ws: Workspace, config: Config, { context, cycles, moved }: Closed): string[] {
  const directory = `${config.contextsDir}/${context}`;
  const held = { context, modules: declaredModules(config, context) };
  const arrived = new Set(moved.map(({ to }) => to));

  const others = cycles
    .flatMap(({ steps }) => steps.filter(({ added }) => added).flatMap(({ imports }) => imports))
    .map(otherEnd(arrived))
    .filter((file) => ws.exists(file))
    .map((file) => file.slice(directory.length + 1))
    .filter((file) => placeInModule(file, held) === 'moves');

  return [...new Set(others)].sort();
}

function otherEnd(arrived: ReadonlySet<string>): (one: ModuleImport) => string {
  return ({ file, imported }) => (arrived.has(file) ? imported : file);
}
