import type { ProcessDecision } from './process-decision.js';

/**
 * A class of `application/processes/`: a long-running process that reacts to events, keeps a
 * state of its own and sends commands. Its steps are plain functions of the current state and
 * what happened, answering a `ProcessDecision`: it holds no repository and writes no aggregate,
 * the commands do (`process/sends-commands-only`). Its timeouts are the one step every process
 * has; the other steps are methods named after what they react to.
 */
export interface ProcessManager<State> {
  /** The step run when the timeout `name` is due. */
  timedOut(name: string, current: State): ProcessDecision<State> | undefined;
}
