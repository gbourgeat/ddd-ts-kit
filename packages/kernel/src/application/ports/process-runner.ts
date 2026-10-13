import type { ProcessDecision } from '../process/process-decision.js';
import type { ProcessTimeoutDue } from '../process/process-timeout-due.js';
import type { ProcessType } from '../process/process-type.js';

/**
 * Runs the steps of the process managers: in one unit of work, it loads the instance a key
 * correlates, asks the step its decision, saves the state with optimistic concurrency, arms
 * and disarms the timeouts as delayed background jobs, and sends the commands.
 */
export abstract class ProcessRunner {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.ProcessRunner' });
  }

  /**
   * The step of an event: `current` is undefined while the instance does not exist. An ended
   * instance ignores it. A step decided concurrently fails with `ConcurrencyError`: the
   * redelivery of an integration event runs it again on the new state, and the caller of the
   * command that raised a domain event retries that command.
   */
  abstract run<State>(
    process: ProcessType<State>,
    id: string,
    step: (current: State | undefined) => ProcessDecision<State> | undefined,
  ): Promise<void>;

  /**
   * The step of a timeout, called by the timeout job of the process with `execution.jobId`:
   * run only while that very job is the armed one, never after it was disarmed or the process ended.
   */
  abstract timeout<State>(
    process: ProcessType<State>,
    due: ProcessTimeoutDue & { readonly jobId: string },
    step: (current: State) => ProcessDecision<State> | undefined,
  ): Promise<void>;
}
