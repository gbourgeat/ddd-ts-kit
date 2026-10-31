import type { Clock, ExecutionScope, Logger, Metrics } from '@ddd-ts-kit/kernel';
import type { JobTimers } from '../job-timers';
import type { BackgroundJobObserver } from './background-job-observer';
import type { JobStore } from './store/job-store';

export interface QueueWorkerOptions {
  readonly store: JobStore;
  /** Every instant comes from it. */
  readonly clock: Clock;
  /** Each attempt runs inside it, in a context of origin `queue`. */
  readonly scope: ExecutionScope;
  /** Default: writes nothing. */
  readonly logger?: Logger;
  /**
   * Default: measures nothing. Given, it also receives the depth of each queue from
   * `store.stats()`, as the gauges `jobs_waiting`, `jobs_running` and `jobs_dead` labelled with
   * the `queue`, at most once per poll interval.
   */
  readonly metrics?: Metrics;
  /** Default: the timers of the runtime. */
  readonly timers?: JobTimers;
  /**
   * How many attempts of one queue run at once in this process: a number for every queue, or a
   * number per queue with `default` for the others. Default 1. A limit per process, not across
   * the workers of a deployment.
   */
  readonly concurrency?: number | Readonly<Record<string, number>>;
  /** How long an idle queue waits before it asks the store again. Default 1000. */
  readonly pollIntervalMs?: number;
  /** How long `stop()` waits for the attempts in progress before aborting them. Default 30 000. */
  readonly graceMs?: number;
  readonly onRun?: BackgroundJobObserver;
}
