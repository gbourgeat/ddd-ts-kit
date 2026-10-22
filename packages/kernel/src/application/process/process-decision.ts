import type { Command } from '../messaging/command';
import type { ProcessTimeout } from './process-timeout';

/**
 * What one step of a process decides, as data: its next state, the commands it sends, the
 * timeouts it arms or disarms, and whether it is over. A step that answers `undefined` ignores
 * what it was given.
 */
export interface ProcessDecision<State> {
  readonly state: State;
  /** Sent in order, in the unit of work of the step: their changes commit with the state of the process. */
  readonly commands?: readonly Command<unknown>[];
  readonly timeouts?: readonly ProcessTimeout[];
  /** The names of armed timeouts the step disarms. */
  readonly cancel?: readonly string[];
  /** An ended process ignores every later event and timeout. */
  readonly ended?: boolean;
}
