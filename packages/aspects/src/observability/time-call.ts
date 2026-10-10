import type { Clock, MetricLabels, Metrics } from '@ddd-ts-kit/kernel';
import { observed } from './observed.js';

export interface TimedCall {
  readonly metrics: Metrics;
  readonly clock: Clock;
  readonly name: string;
  readonly labels: MetricLabels;
}

/** The duration and the outcome of one call, in the two series named after `name`. */
export function timeCall<T>(call: TimedCall, proceed: () => Promise<T>): Promise<T> {
  const { metrics, name, labels } = call;

  return observed(call.clock, proceed, ({ durationMs, error }) => {
    const outcome = error === undefined ? 'success' : 'failure';

    metrics.histogram(`${name}_duration_ms`).record(durationMs, { ...labels, outcome });
    metrics.counter(`${name}_total`).increment({ ...labels, outcome, error_code: error?.errorCode });
  });
}
