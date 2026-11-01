import type { Cache, Clock, ExecutionScope, Logger, Metrics } from '@ddd-ts-kit/kernel';
import type { Scheduler } from './scheduler';

/**
 * The collaborators aspects resolve when a call is made, not when a class is decorated or an
 * instance wrapped. Install what the aspects in use need: `logged` a logger, `timed` metrics,
 * `cached` a cache and the execution scope, which it needs to confine its entries to the tenant of
 * the work (it throws at the call without it, unless `shared: true`).
 * The clock and the scheduler default to the system ones.
 */
export interface AspectRuntime {
  readonly logger?: Logger;
  readonly metrics?: Metrics;
  readonly cache?: Cache;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
  readonly scope?: ExecutionScope;
}
