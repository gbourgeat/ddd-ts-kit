import type { BusMiddleware, Clock, Metrics } from '@ddd-ts-kit/kernel';
import { clockOr } from '../runtime/clock-or';
import { timeCall } from './time-call';

export interface MetricsMiddlewareOptions {
  /** Prefix of the two series: `<name>_duration_ms` and `<name>_total`. Default `use_case`. */
  readonly name?: string;
  /** Defaults to the clock of the aspect runtime, then to the system clock. */
  readonly clock?: Clock;
}

/** `timed` for use cases: duration and outcome of every command and query, labelled `message` and `kind`. */
export function metricsMiddleware(metrics: Metrics, options: MetricsMiddlewareOptions = {}): BusMiddleware {
  return (_message, next, info) =>
    timeCall(
      {
        metrics,
        clock: clockOr(options.clock),
        name: options.name ?? 'use_case',
        labels: { message: info.name, kind: info.kind },
      },
      next,
    );
}
