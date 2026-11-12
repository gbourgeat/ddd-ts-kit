import { CliError } from '../cli-error';
import type { ClosedCycle } from './closed-cycles';
import { cycleLines } from './cycle-lines';

/** The flag that lets a move close a cycle between modules. */
export const ALLOW_CYCLE = 'allow-cycle';

/** The exit code of a mistake of the caller. */
const REFUSED = 2;

const INVERT =
  'Invert one of the imports above before the move: `ddd-ts-kit explain module/no-cycle` gives the ways (a domain event, a module of its own for the concept both reach for, a projection).';

const ALLOW = `Pass --${ALLOW_CYCLE} to move as asked all the same: module/no-cycle then reports the cycle.`;

/** What a move that closes a cycle is refused with. */
export interface Refused {
  readonly context: string;
  readonly cycles: readonly ClosedCycle[];
  /** The files that, moved in the same command, take the imports the move adds out of the cycle: relative to the context. */
  readonly along: readonly string[];
}

/**
 * The refusal of a move that would close a cycle between modules: nothing was written, the cycle
 * is named with the imports that make it, and what avoids it is said, the file to move along first.
 */
export function cycleRefusal({ context, cycles, along }: Refused): CliError {
  const what = cycles.length === 1 ? 'a cycle that is' : `${cycles.length} cycles that are`;

  const moveAlong =
    along.length > 0
      ? [
          `Move along, in the same command, what stands at the other end of the imports the move adds: ${along.join(', ')}; the command judges that move the same way.`,
        ]
      : [];

  return new CliError(
    [
      `Nothing was moved: the move would close between the modules of "${context}" ${what} not there now.`,
      ...cycleLines(cycles).map((line) => `  ${line}`),
    ].join('\n'),
    [...moveAlong, INVERT, ALLOW].join('\n'),
    REFUSED,
    { cycles, along },
  );
}
