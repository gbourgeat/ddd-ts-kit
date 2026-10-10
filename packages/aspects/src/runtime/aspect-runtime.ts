import type { Cache, Clock, Logger, Metrics } from '@ddd-ts-kit/kernel';
import type { Scheduler } from './scheduler.js';

/**
 * The collaborators aspects resolve when a call is made, not when a class is decorated or an
 * instance wrapped. Install what the aspects in use need: `logged` a logger, `timed` metrics,
 * `cached` a cache. The clock and the scheduler default to the system ones.
 */
export interface AspectRuntime {
  readonly logger?: Logger;
  readonly metrics?: Metrics;
  readonly cache?: Cache;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
}
